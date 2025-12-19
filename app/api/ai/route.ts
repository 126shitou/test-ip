import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

// 初始化 Upstash Redis（需要在环境变量中配置）
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL!,
    token: process.env.UPSTASH_REDIS_TOKEN!,
});

// 每日限制次数
const DAILY_LIMIT = 3;

// FP 碰撞检测阈值：1小时内出现多少个不同 IP 视为碰撞
const FP_COLLISION_IP_THRESHOLD = 3;
// FP-IP 关联记录的 TTL（1小时）
const FP_IP_TTL_SECONDS = 60 * 60;

// 获取今天的日期字符串（用于 Redis key）
function getTodayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// 获取客户端真实 IP
function getClientIP(headersList: Headers): string {
    // 优先从常见代理头获取
    const forwardedFor = headersList.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
    }

    const realIP = headersList.get("x-real-ip");
    if (realIP) {
        return realIP;
    }

    // Vercel 特有
    const vercelForwardedFor = headersList.get("x-vercel-forwarded-for");
    if (vercelForwardedFor) {
        return vercelForwardedFor.split(",")[0].trim();
    }

    // Cloudflare 特有
    const cfConnectingIP = headersList.get("cf-connecting-ip");
    if (cfConnectingIP) {
        return cfConnectingIP;
    }

    return "unknown";
}

// 计算距离明天 0 点的秒数（用于 Redis key 过期）
function getSecondsUntilMidnight(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return Math.ceil((tomorrow.getTime() - now.getTime()) / 1000);
}

export async function POST(request: Request) {
    try {
        const headersList = await headers();
        const body = await request.json();

        // 1. 获取基本信息
        const visitorId = body.visitorId as string | undefined;
        const clientIP = getClientIP(headersList);
        const userAgent = headersList.get("user-agent") || "unknown";
        const todayKey = getTodayKey();

        // 2. 校验 visitorId
        if (!visitorId || typeof visitorId !== "string" || visitorId.length < 10) {
            return Response.json(
                {
                    success: false,
                    error: "Invalid or missing visitorId",
                    data: null,
                },
                { status: 400 }
            );
        }

        // 3. 构建 Redis key
        // 单独对 visitorId 限流（主要维度）
        const fingerprintKey = `ratelimit:fp:${visitorId}:${todayKey}`;
        // 单独对 IP 限流
        const ipKey = `ratelimit:ip:${clientIP}:${todayKey}`;
        // 组合 key（碰撞时使用）
        const combinedKey = `ratelimit:combined:${visitorId}:${clientIP}:${todayKey}`;
        // FP 关联的 IP 集合（用于碰撞检测，1小时窗口）
        const fpIpSetKey = `fp:ips:${visitorId}`;

        // 4. 记录 FP-IP 关联 & 获取当前 FP 关联的 IP 数量
        // 先添加当前 IP 到集合，再获取集合大小
        await redis.sadd(fpIpSetKey, clientIP);
        await redis.expire(fpIpSetKey, FP_IP_TTL_SECONDS);

        // 5. 获取当前使用次数 & FP 关联的 IP 数量
        const [fpCount, ipCount, combinedCount, fpIpCount] = await Promise.all([
            redis.get<number>(fingerprintKey),
            redis.get<number>(ipKey),
            redis.get<number>(combinedKey),
            redis.scard(fpIpSetKey),
        ]);

        const currentFpUsage = fpCount || 0;
        const currentIpUsage = ipCount || 0;
        const currentCombinedUsage = combinedCount || 0;
        const fpRelatedIpCount = fpIpCount || 0;

        // 6. 检测 FP 碰撞：同一 FP 在 1 小时内出现 >= 3 个不同 IP
        const isFpCollision = fpRelatedIpCount >= FP_COLLISION_IP_THRESHOLD;

        // 7. 根据是否碰撞选择限流策略
        // - 正常情况：使用 FP 作为主要限流维度
        // - 碰撞情况：使用 FP+IP 组合限流（每个 IP 独立计数）
        const effectiveUsage = isFpCollision ? currentCombinedUsage : currentFpUsage;
        const isLimited = effectiveUsage >= DAILY_LIMIT;
        const remaining = Math.max(0, DAILY_LIMIT - effectiveUsage);

        // 8. 如果未超限，增加计数
        let newUsageCount = effectiveUsage;
        if (!isLimited) {
            const ttl = getSecondsUntilMidnight();

            // 并行增加所有维度的计数
            await Promise.all([
                redis.incr(fingerprintKey).then(() => redis.expire(fingerprintKey, ttl)),
                redis.incr(ipKey).then(() => redis.expire(ipKey, ttl)),
                redis.incr(combinedKey).then(() => redis.expire(combinedKey, ttl)),
            ]);

            newUsageCount = effectiveUsage + 1;
        }

        // 9. 构建限流原因说明
        let limitReason: string | null = null;
        if (isLimited) {
            if (isFpCollision) {
                limitReason = `检测到指纹碰撞（1小时内 ${fpRelatedIpCount} 个不同IP使用同一指纹），已切换到 IP+指纹 组合限流，当前 IP 今日额度已用完`;
            } else {
                limitReason = `该设备指纹今日使用次数已达上限（${DAILY_LIMIT}次）`;
            }
        }

        // 10. 构建响应数据
        const responseData = {
            success: !isLimited,
            data: {
                // 用户标识信息
                visitorId,
                clientIP,
                userAgent,

                // 限流状态
                dailyLimit: DAILY_LIMIT,
                usedToday: newUsageCount,
                remaining: isLimited ? 0 : remaining - 1,
                isLimited,
                // 限流原因（仅在被限流时返回）
                limitReason,

                // FP 碰撞检测信息
                collision: {
                    detected: isFpCollision,
                    relatedIpCount: fpRelatedIpCount,
                    threshold: FP_COLLISION_IP_THRESHOLD,
                    strategy: isFpCollision ? "combined" : "fingerprint",
                },

                // 多维度使用情况（调试用）
                usageDetails: {
                    byFingerprint: isLimited ? currentFpUsage : currentFpUsage + 1,
                    byIP: isLimited ? currentIpUsage : currentIpUsage + 1,
                    byCombined: isLimited ? currentCombinedUsage : currentCombinedUsage + 1,
                },

                // 时间信息
                date: todayKey,
                resetAt: (() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(0, 0, 0, 0);
                    return tomorrow.toISOString();
                })(),
            },
            message: isLimited
                ? limitReason
                : isFpCollision
                    ? `检测到 FP 碰撞（${fpRelatedIpCount}个IP），已切换到组合限流。今日还剩 ${remaining - 1} 次`
                    : `本次调用成功，今日还剩 ${remaining - 1} 次`,
        };

        return Response.json(responseData, {
            status: isLimited ? 429 : 200,
            headers: {
                "X-RateLimit-Limit": String(DAILY_LIMIT),
                "X-RateLimit-Remaining": String(isLimited ? 0 : remaining - 1),
                "X-RateLimit-Reset": responseData.data.resetAt,
            },
        });
    } catch (error) {
        console.error("Rate limit API error:", error);
        return Response.json(
            {
                success: false,
                error: "Internal server error",
                data: null,
            },
            { status: 500 }
        );
    }
}

// GET 方法：查询当前使用情况（不消耗次数）
export async function GET(request: Request) {
    try {
        const headersList = await headers();
        const { searchParams } = new URL(request.url);

        const visitorId = searchParams.get("visitorId");
        const clientIP = getClientIP(headersList);
        const todayKey = getTodayKey();

        if (!visitorId) {
            return Response.json(
                {
                    success: false,
                    error: "Missing visitorId query parameter",
                    data: null,
                },
                { status: 400 }
            );
        }

        // 获取当前使用次数
        const fingerprintKey = `ratelimit:fp:${visitorId}:${todayKey}`;
        const ipKey = `ratelimit:ip:${clientIP}:${todayKey}`;
        const combinedKey = `ratelimit:combined:${visitorId}:${clientIP}:${todayKey}`;
        const fpIpSetKey = `fp:ips:${visitorId}`;

        const [fpCount, ipCount, combinedCount, fpIpCount] = await Promise.all([
            redis.get<number>(fingerprintKey),
            redis.get<number>(ipKey),
            redis.get<number>(combinedKey),
            redis.scard(fpIpSetKey),
        ]);

        const currentFpUsage = fpCount || 0;
        const currentCombinedUsage = combinedCount || 0;
        const fpRelatedIpCount = fpIpCount || 0;

        // 检测 FP 碰撞
        const isFpCollision = fpRelatedIpCount >= FP_COLLISION_IP_THRESHOLD;
        const effectiveUsage = isFpCollision ? currentCombinedUsage : currentFpUsage;
        const remaining = Math.max(0, DAILY_LIMIT - effectiveUsage);

        // 判断限流状态和原因
        const isLimited = effectiveUsage >= DAILY_LIMIT;

        // 构建限流原因说明
        let limitReason: string | null = null;
        if (isLimited) {
            if (isFpCollision) {
                limitReason = `检测到指纹碰撞（1小时内 ${fpRelatedIpCount} 个不同IP使用同一指纹），已切换到 IP+指纹 组合限流，当前 IP 今日额度已用完`;
            } else {
                limitReason = `该设备指纹今日使用次数已达上限（${DAILY_LIMIT}次）`;
            }
        }

        return Response.json({
            success: true,
            data: {
                visitorId,
                clientIP,
                dailyLimit: DAILY_LIMIT,
                usedToday: effectiveUsage,
                remaining,
                isLimited,
                // 限流原因（仅在被限流时返回）
                limitReason,
                collision: {
                    detected: isFpCollision,
                    relatedIpCount: fpRelatedIpCount,
                    threshold: FP_COLLISION_IP_THRESHOLD,
                    strategy: isFpCollision ? "combined" : "fingerprint",
                },
                usageDetails: {
                    byFingerprint: currentFpUsage,
                    byIP: ipCount || 0,
                    byCombined: currentCombinedUsage,
                },
                date: todayKey,
            },
            message: isLimited
                ? limitReason
                : isFpCollision
                    ? `检测到 FP 碰撞，今日已使用 ${effectiveUsage}/${DAILY_LIMIT} 次（组合限流）`
                    : `今日已使用 ${effectiveUsage}/${DAILY_LIMIT} 次`,
        });
    } catch (error) {
        console.error("Rate limit query error:", error);
        return Response.json(
            {
                success: false,
                error: "Internal server error",
                data: null,
            },
            { status: 500 }
        );
    }
}
