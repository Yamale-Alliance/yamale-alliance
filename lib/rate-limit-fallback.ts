import type { NextRequest } from "next/server";
import type { RateLimitResult } from "@/lib/runtime-security-types";

type RateLimitRule = {
  windowMs: number;
  limit: number;
};

type HitLog = {
  hits: number[];
};

function getRateLimitStore(): Map<string, HitLog> {
  const g = globalThis as typeof globalThis & {
    __yamaleRateLimitStore?: Map<string, HitLog>;
  };
  if (!g.__yamaleRateLimitStore) {
    g.__yamaleRateLimitStore = new Map<string, HitLog>();
  }
  return g.__yamaleRateLimitStore;
}

function pruneAndCount(hits: number[], windowStart: number): number[] {
  let idx = 0;
  while (idx < hits.length && hits[idx] < windowStart) idx++;
  return idx === 0 ? hits : hits.slice(idx);
}

/** Dev / single-instance fallback when Upstash is not configured. */
export function checkInMemoryRateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const windowStart = now - rule.windowMs;
  const store = getRateLimitStore();
  const current = store.get(key) ?? { hits: [] };
  const prunedHits = pruneAndCount(current.hits, windowStart);

  if (prunedHits.length >= rule.limit) {
    const oldest = prunedHits[0] ?? now;
    const retryAfterMs = Math.max(0, oldest + rule.windowMs - now);
    return {
      allowed: false,
      limit: rule.limit,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  prunedHits.push(now);
  store.set(key, { hits: prunedHits });
  return {
    allowed: true,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - prunedHits.length),
    retryAfterSeconds: 0,
  };
}

export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}
