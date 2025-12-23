import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

// 初始化 Upstash Redis（需要在环境变量中配置）
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL!,
    token: process.env.UPSTASH_REDIS_TOKEN!,
});

// Cloudflare Turnstile Secret Key（从环境变量获取）
// 测试 secret: 1x0000000000000000000000000000000AA (总是通过)
// 测试 secret: 2x0000000000000000000000000000000AA (总是失败)
// 后端环境变量不需要 NEXT_PUBLIC_ 前缀
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "1x0000000000000000000000000000000AA";

// Turnstile 验证接口响应类型
interface TurnstileVerifyResponse {
    success: boolean;
    "error-codes"?: string[];
    challenge_ts?: string;
    hostname?: string;
    action?: string;
    cdata?: string;
}

// 验证 Turnstile token
async function verifyTurnstileToken(token: string, clientIP: string): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                secret: TURNSTILE_SECRET_KEY,
                response: token,
                remoteip: clientIP,
            }),
        });

        const data: TurnstileVerifyResponse = await response.json();

        if (!data.success) {
            const errorCodes = data["error-codes"]?.join(", ") || "unknown";
            console.warn("Turnstile verification failed:", errorCodes);
            return { success: false, error: `人机验证失败: ${errorCodes}` };
        }

        return { success: true };
    } catch (error) {
        console.error("Turnstile verification error:", error);
        return { success: false, error: "人机验证服务异常" };
    }
}

// 每日限制次数
const DAILY_LIMIT = 3;

// FP 碰撞检测阈值：1小时内出现多少个不同 IP 视为碰撞
const FP_COLLISION_IP_THRESHOLD = 3;
// IP 碰撞检测阈值：1小时内出现多少个不同 FP 视为碰撞
const IP_COLLISION_FP_THRESHOLD = 5;
// FP-IP / IP-FP 关联记录的 TTL（1小时）
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
        const turnstileToken = body.turnstileToken as string | undefined;
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

        // 3. 验证 Turnstile token（人机验证）
        if (!turnstileToken || typeof turnstileToken !== "string") {
            return Response.json(
                {
                    success: false,
                    error: "Missing Turnstile token - 请完成人机验证",
                    data: null,
                },
                { status: 400 }
            );
        }

        const turnstileResult = await verifyTurnstileToken(turnstileToken, clientIP);
        if (!turnstileResult.success) {
            return Response.json(
                {
                    success: false,
                    error: turnstileResult.error || "人机验证失败",
                    data: null,
                },
                { status: 403 }
            );
        }

        // 4. 构建 Redis key
        // 单独对 visitorId 限流（主要维度）
        const fingerprintKey = `ratelimit:fp:${visitorId}:${todayKey}`;
        // 单独对 IP 限流
        const ipKey = `ratelimit:ip:${clientIP}:${todayKey}`;
        // 组合 key（碰撞时使用）
        const combinedKey = `ratelimit:combined:${visitorId}:${clientIP}:${todayKey}`;
        // FP 关联的 IP 集合（用于碰撞检测，1小时窗口）
        const fpIpSetKey = `fp:ips:${visitorId}`;
        // IP 关联的 FP 集合（用于碰撞检测，1小时窗口）
        const ipFpSetKey = `ip:fps:${clientIP}`;

        // 5. 记录 FP-IP 和 IP-FP 双向关联
        // 先添加到集合，再获取集合大小
        await Promise.all([
            redis.sadd(fpIpSetKey, clientIP),
            redis.sadd(ipFpSetKey, visitorId),
        ]);
        await Promise.all([
            redis.expire(fpIpSetKey, FP_IP_TTL_SECONDS),
            redis.expire(ipFpSetKey, FP_IP_TTL_SECONDS),
        ]);

        // 6. 获取当前使用次数 & 碰撞检测数据
        const [fpCount, ipCount, combinedCount, fpIpCount, ipFpCount] = await Promise.all([
            redis.get<number>(fingerprintKey),
            redis.get<number>(ipKey),
            redis.get<number>(combinedKey),
            redis.scard(fpIpSetKey),
            redis.scard(ipFpSetKey),
        ]);

        const currentFpUsage = fpCount || 0;
        const currentIpUsage = ipCount || 0;
        const currentCombinedUsage = combinedCount || 0;
        const fpRelatedIpCount = fpIpCount || 0;
        const ipRelatedFpCount = ipFpCount || 0;

        // 7. 碰撞检测
        // 7.1 FP 碰撞：同一 FP 在 1 小时内出现 >= 3 个不同 IP
        const isFpCollision = fpRelatedIpCount >= FP_COLLISION_IP_THRESHOLD;
        // 7.2 IP 碰撞：同一 IP 在 1 小时内出现 >= 5 个不同 FP
        const isIpCollision = ipRelatedFpCount >= IP_COLLISION_FP_THRESHOLD;

        // 8. 判断是否限流
        // - FP 碰撞：直接封禁该 FP（所有 IP 都不能用）
        // - IP 碰撞：直接封禁该 IP（所有 FP 都不能用）
        // - 正常情况：使用 FP 作为主要限流维度
        const isLimitedByFpCollision = isFpCollision; // FP 碰撞封禁
        const isLimitedByIpCollision = isIpCollision; // IP 碰撞封禁
        const isLimitedByUsage = currentFpUsage >= DAILY_LIMIT; // 正常限流
        const isLimited = isLimitedByFpCollision || isLimitedByIpCollision || isLimitedByUsage;
        const remaining = (isLimitedByFpCollision || isLimitedByIpCollision) ? 0 : Math.max(0, DAILY_LIMIT - currentFpUsage);

        // 9. 如果未超限，增加计数
        let newUsageCount = currentFpUsage;
        if (!isLimited) {
            const ttl = getSecondsUntilMidnight();

            // 并行增加所有维度的计数
            await Promise.all([
                redis.incr(fingerprintKey).then(() => redis.expire(fingerprintKey, ttl)),
                redis.incr(ipKey).then(() => redis.expire(ipKey, ttl)),
                redis.incr(combinedKey).then(() => redis.expire(combinedKey, ttl)),
            ]);

            newUsageCount = currentFpUsage + 1;
        }

        // 10. 构建限流原因说明
        let limitReason: string | null = null;
        if (isLimited) {
            if (isLimitedByFpCollision) {
                limitReason = `检测到指纹异常（1小时内 ${fpRelatedIpCount} 个不同IP使用同一指纹，超过阈值 ${FP_COLLISION_IP_THRESHOLD}），该指纹已被临时封禁`;
            } else if (isLimitedByIpCollision) {
                limitReason = `检测到IP异常（1小时内 ${ipRelatedFpCount} 个不同指纹使用同一IP，超过阈值 ${IP_COLLISION_FP_THRESHOLD}），该IP已被临时封禁`;
            } else {
                limitReason = `该设备指纹今日使用次数已达上限（${DAILY_LIMIT}次）`;
            }
        }

        // 11. 构建响应数据
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

                // 碰撞检测信息
                collision: {
                    // FP 碰撞：同一 FP 被多个 IP 使用
                    fpCollision: {
                        detected: isFpCollision,
                        blocked: isLimitedByFpCollision,
                        relatedIpCount: fpRelatedIpCount,
                        threshold: FP_COLLISION_IP_THRESHOLD,
                    },
                    // IP 碰撞：同一 IP 被多个 FP 使用
                    ipCollision: {
                        detected: isIpCollision,
                        blocked: isLimitedByIpCollision,
                        relatedFpCount: ipRelatedFpCount,
                        threshold: IP_COLLISION_FP_THRESHOLD,
                    },
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
        const ipFpSetKey = `ip:fps:${clientIP}`;

        const [fpCount, ipCount, combinedCount, fpIpCount, ipFpCount] = await Promise.all([
            redis.get<number>(fingerprintKey),
            redis.get<number>(ipKey),
            redis.get<number>(combinedKey),
            redis.scard(fpIpSetKey),
            redis.scard(ipFpSetKey),
        ]);

        const currentFpUsage = fpCount || 0;
        const currentCombinedUsage = combinedCount || 0;
        const fpRelatedIpCount = fpIpCount || 0;
        const ipRelatedFpCount = ipFpCount || 0;

        // 碰撞检测
        const isFpCollision = fpRelatedIpCount >= FP_COLLISION_IP_THRESHOLD;
        const isIpCollision = ipRelatedFpCount >= IP_COLLISION_FP_THRESHOLD;

        // 判断限流状态
        // - FP 碰撞：直接封禁该 FP（所有 IP 都不能用）
        // - IP 碰撞：直接封禁该 IP（所有 FP 都不能用）
        // - 正常情况：使用 FP 作为主要限流维度
        const isLimitedByFpCollision = isFpCollision;
        const isLimitedByIpCollision = isIpCollision;
        const isLimitedByUsage = currentFpUsage >= DAILY_LIMIT;
        const isLimited = isLimitedByFpCollision || isLimitedByIpCollision || isLimitedByUsage;
        const remaining = (isLimitedByFpCollision || isLimitedByIpCollision) ? 0 : Math.max(0, DAILY_LIMIT - currentFpUsage);

        // 构建限流原因说明
        let limitReason: string | null = null;
        if (isLimited) {
            if (isLimitedByFpCollision) {
                limitReason = `检测到指纹异常（1小时内 ${fpRelatedIpCount} 个不同IP使用同一指纹，超过阈值 ${FP_COLLISION_IP_THRESHOLD}），该指纹已被临时封禁`;
            } else if (isLimitedByIpCollision) {
                limitReason = `检测到IP异常（1小时内 ${ipRelatedFpCount} 个不同指纹使用同一IP，超过阈值 ${IP_COLLISION_FP_THRESHOLD}），该IP已被临时封禁`;
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
                usedToday: currentFpUsage,
                remaining,
                isLimited,
                // 限流原因（仅在被限流时返回）
                limitReason,
                collision: {
                    // FP 碰撞：同一 FP 被多个 IP 使用
                    fpCollision: {
                        detected: isFpCollision,
                        blocked: isLimitedByFpCollision,
                        relatedIpCount: fpRelatedIpCount,
                        threshold: FP_COLLISION_IP_THRESHOLD,
                    },
                    // IP 碰撞：同一 IP 被多个 FP 使用
                    ipCollision: {
                        detected: isIpCollision,
                        blocked: isLimitedByIpCollision,
                        relatedFpCount: ipRelatedFpCount,
                        threshold: IP_COLLISION_FP_THRESHOLD,
                    },
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
                : `今日已使用 ${currentFpUsage}/${DAILY_LIMIT} 次`,
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
