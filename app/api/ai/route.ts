import { NextResponse } from "next/server";
import { aiRatelimit } from "@/lib/upstash";

function getClientIp(req: Request): string | null {
    // Common proxy header (Vercel/NGINX/etc). May contain multiple IPs.
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]?.trim() || null;

    // Some proxies use this.
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    return null;
}

export async function POST(req: Request) {
    let body: unknown = null;
    try {
        // Allow empty body.
        body = await req.json().catch(() => null);
    } catch {
        body = null;
    }

    const visitorIdFromHeader = req.headers.get("x-visitor-id")?.trim();
    const visitorIdFromBody =
        body && typeof body === "object" && "visitorId" in body
            ? String((body as { visitorId?: unknown }).visitorId ?? "").trim()
            : "";

    const visitorId = visitorIdFromHeader || visitorIdFromBody || null;
    const ip = getClientIp(req);

    // Prefer visitorId for "anonymous quota". Fallback to IP so the endpoint is still protected.
    const identifier = visitorId ? `vid:${visitorId}` : ip ? `ip:${ip}` : "unknown";

    const { success, limit, remaining, reset } = await aiRatelimit.limit(identifier);

    const commonHeaders = new Headers({
        "x-ratelimit-limit": String(limit),
        "x-ratelimit-remaining": String(remaining),
        // reset is a Unix timestamp in ms
        "x-ratelimit-reset": String(reset),
    });

    if (!success) {
        const retryAfterSeconds = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
        commonHeaders.set("retry-after", String(retryAfterSeconds));

        return NextResponse.json(
            {
                ok: false,
                error: "RATE_LIMITED",
                identifier,
                visitorId,
                ip,
                limit,
                remaining,
                reset,
                retryAfterSeconds,
            },
            { status: 429, headers: commonHeaders },
        );
    }

    const prompt =
        body && typeof body === "object" && "prompt" in body
            ? String((body as { prompt?: unknown }).prompt ?? "")
            : "";

    // Simulate model latency.
    await new Promise((r) => setTimeout(r, 250));

    return NextResponse.json(
        {
            ok: true,
            identifier,
            visitorId,
            ip,
            prompt,
            // Simulated response
            answer: `模拟AI回复：你刚才的输入是「${prompt || "（空）"}」。`,
            usage: { inputTokens: Math.min(2000, prompt.length), outputTokens: 32 },
            limit,
            remaining,
            reset,
        },
        { headers: commonHeaders },
    );
}


