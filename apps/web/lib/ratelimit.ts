import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

// Lazy singleton. Any route can call `checkLimit(name, key, window)`; the
// shared Redis client is constructed once per process. When Upstash env vars
// are not set (local dev without a Redis), limiters short-circuit to "allow"
// so the app still runs — the tradeoff is that local dev isn't rate-limited.

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!redis) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

function getLimiter(
  name: string,
  max: number,
  window: Parameters<typeof Ratelimit.slidingWindow>[1],
): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;

  const cacheKey = `${name}:${max}:${window}`;
  const existing = limiters.get(cacheKey);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(max, window),
    prefix: `obscura:rl:${name}`,
    analytics: false,
  });
  limiters.set(cacheKey, limiter);
  return limiter;
}

// Returns true when the request is within limits OR the limiter is disabled.
// Never returns false for a configuration reason — only for a real rate exceedance.
export async function checkLimit(
  name: string,
  key: string,
  max: number,
  window: Parameters<typeof Ratelimit.slidingWindow>[1],
): Promise<boolean> {
  const limiter = getLimiter(name, max, window);
  if (!limiter) return true;
  const { success } = await limiter.limit(key);
  return success;
}
