import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

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

// Allows when Upstash env vars are unset (dev).
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
