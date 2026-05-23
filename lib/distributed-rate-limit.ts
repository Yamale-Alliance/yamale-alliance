import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";
import { checkInMemoryRateLimit, getClientIp } from "@/lib/rate-limit-fallback";
import type { RateLimitResult } from "@/lib/runtime-security-types";

export type RateLimitContext = {
  userId?: string | null;
};

type LimiterBucket = {
  /** Sliding window: max requests per minute */
  requests: number;
  window: `${number} m` | `${number} s`;
};

const BUCKETS = {
  webhookIp: { requests: 30, window: "1 m" } satisfies LimiterBucket,
  adminIp: { requests: 90, window: "1 m" } satisfies LimiterBucket,
  aiChatUser: { requests: 25, window: "1 m" } satisfies LimiterBucket,
  aiChatIp: { requests: 60, window: "1 m" } satisfies LimiterBucket,
  aiGeneralIp: { requests: 80, window: "1 m" } satisfies LimiterBucket,
  paymentsUser: { requests: 20, window: "1 m" } satisfies LimiterBucket,
  paymentsIp: { requests: 40, window: "1 m" } satisfies LimiterBucket,
  apiIp: { requests: 120, window: "1 m" } satisfies LimiterBucket,
} as const;

let redis: Redis | null | undefined;
const limiterCache = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redis = null;
    return null;
  }
  redis = new Redis({ url, token });
  return redis;
}

export function isDistributedRateLimitEnabled(): boolean {
  return getRedis() !== null;
}

function getLimiter(name: string, bucket: LimiterBucket): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const cacheKey = `${name}:${bucket.requests}:${bucket.window}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(bucket.requests, bucket.window),
      prefix: `yamale:rl:${name}`,
      analytics: true,
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

async function applyUpstashLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<RateLimitResult> {
  const res = await limiter.limit(identifier);
  const retryAfterSeconds = res.reset
    ? Math.max(0, Math.ceil((res.reset - Date.now()) / 1000))
    : 60;
  return {
    allowed: res.success,
    limit: res.limit,
    remaining: res.remaining,
    retryAfterSeconds: res.success ? 0 : retryAfterSeconds,
  };
}

function applyMemoryLimit(
  key: string,
  bucket: LimiterBucket
): RateLimitResult {
  const windowMs = bucket.window.endsWith(" m")
    ? Number.parseInt(bucket.window, 10) * 60_000
    : Number.parseInt(bucket.window, 10) * 1000;
  return checkInMemoryRateLimit(key, { windowMs, limit: bucket.requests });
}

async function limit(
  name: string,
  bucket: LimiterBucket,
  identifier: string
): Promise<RateLimitResult> {
  const limiter = getLimiter(name, bucket);
  if (limiter) {
    return applyUpstashLimit(limiter, identifier);
  }
  return applyMemoryLimit(`${name}:${identifier}`, bucket);
}

function pathname(request: NextRequest): string {
  return request.nextUrl.pathname;
}

function isAiChat(path: string): boolean {
  return path === "/api/ai/chat";
}

function isAiApi(path: string): boolean {
  return path.startsWith("/api/ai/");
}

function isPaymentsOrCart(path: string): boolean {
  return path.startsWith("/api/payments/") || path.startsWith("/api/cart/");
}

function isWebhook(path: string): boolean {
  return (
    path === "/api/lomi/webhook" ||
    path === "/api/payments/webhook" ||
    path === "/api/stripe/webhook"
  );
}

/**
 * Distributed rate limits (Upstash Redis) with in-memory fallback for local dev.
 * Applies the strictest failing check when multiple buckets match.
 */
export async function checkDistributedRateLimit(
  request: NextRequest,
  ctx: RateLimitContext = {}
): Promise<RateLimitResult | null> {
  const path = pathname(request);
  if (!path.startsWith("/api/")) return null;

  const ip = getClientIp(request);
  const userId = ctx.userId?.trim() || null;
  const checks: Array<Promise<RateLimitResult>> = [];

  if (isWebhook(path)) {
    checks.push(limit("webhook", BUCKETS.webhookIp, ip));
  } else if (path.startsWith("/api/admin/")) {
    checks.push(limit("admin", BUCKETS.adminIp, ip));
  } else if (isAiChat(path)) {
    checks.push(limit("ai_chat", BUCKETS.aiChatIp, ip));
    if (userId) {
      checks.push(limit("ai_chat_user", BUCKETS.aiChatUser, userId));
    }
  } else if (isAiApi(path)) {
    checks.push(limit("ai", BUCKETS.aiGeneralIp, ip));
    if (userId) {
      checks.push(limit("ai_user", BUCKETS.aiChatUser, userId));
    }
  } else if (isPaymentsOrCart(path)) {
    checks.push(limit("payments", BUCKETS.paymentsIp, ip));
    if (userId) {
      checks.push(limit("payments_user", BUCKETS.paymentsUser, userId));
    }
  } else {
    checks.push(limit("api", BUCKETS.apiIp, ip));
  }

  const results = await Promise.all(checks);
  const denied = results.find((r) => !r.allowed);
  if (denied) return denied;

  const tightest = results.reduce((best, r) => (r.remaining < best.remaining ? r : best), results[0]);
  return tightest ?? null;
}
