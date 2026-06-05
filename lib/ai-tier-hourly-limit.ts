import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { checkInMemoryRateLimit } from "@/lib/rate-limit-fallback";
import type { RateLimitResult } from "@/lib/runtime-security-types";

/** Per-subscription-tier hourly AI chat quotas (ikPin remediation). */
const TIER_HOURLY_LIMITS: Record<string, number> = {
  basic: 20,
  pro: 60,
  team: 150,
  free: 10,
};

let redis: Redis | null | undefined;
let limiterCache = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim();
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function hourlyLimitForTier(tier: string): number {
  const key = (tier || "free").toLowerCase();
  return TIER_HOURLY_LIMITS[key] ?? TIER_HOURLY_LIMITS.free;
}

function getTierLimiter(tier: string): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const limit = hourlyLimitForTier(tier);
  const cacheKey = `tier:${limit}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(limit, "1 h"),
      prefix: "yamale:ai:tier",
      analytics: true,
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

/**
 * Enforce subscription-tier hourly AI chat quota via Vercel KV / Upstash Redis.
 * Falls back to in-memory limiting in local dev when Redis is unset.
 */
export async function checkAiChatTierHourlyLimit(
  userId: string,
  tier: string
): Promise<RateLimitResult> {
  const limit = hourlyLimitForTier(tier);
  const limiter = getTierLimiter(tier);

  if (limiter) {
    const res = await limiter.limit(userId);
    const retryAfterSeconds = res.reset
      ? Math.max(0, Math.ceil((res.reset - Date.now()) / 1000))
      : 3600;
    return {
      allowed: res.success,
      limit: res.limit,
      remaining: res.remaining,
      retryAfterSeconds: res.success ? 0 : retryAfterSeconds,
    };
  }

  return checkInMemoryRateLimit(`ai_tier_hourly:${tier}:${userId}`, {
    windowMs: 60 * 60 * 1000,
    limit,
  });
}

export function aiChatTierHourlyLimitMessage(tier: string): string {
  const limit = hourlyLimitForTier(tier);
  return `You have reached your hourly AI research limit (${limit} queries per hour on the ${tier} plan). Please wait and try again, or upgrade your plan.`;
}

/** Hard cap on user query length for AI chat (security remediation). */
export const AI_CHAT_MAX_QUERY_CHARS = 4000;

export function validateAiChatQueryLength(
  userQuery: string
): { ok: true } | { ok: false; error: string } {
  const len = userQuery.trim().length;
  if (len > AI_CHAT_MAX_QUERY_CHARS) {
    return {
      ok: false,
      error: `Your query is too long (maximum ${AI_CHAT_MAX_QUERY_CHARS} characters). Shorten it and try again.`,
    };
  }
  return { ok: true };
}
