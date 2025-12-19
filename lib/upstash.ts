import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

// Default limiter for "anonymous AI usage" without login.
// Tune these numbers based on your product needs.
export const aiRatelimit = new Ratelimit({
    redis,
    prefix: "ratelimit:ai",
    limiter: Ratelimit.slidingWindow(20, "1 d"),
    analytics: true,
});


