import { NextRequest, NextResponse } from "next/server";

type RateLimitRule = {
  windowMs: number;
  limit: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type HitLog = {
  hits: number[];
};

const RATE_LIMIT_RULES: Array<{ test: (path: string) => boolean; rule: RateLimitRule }> = [
  { test: (path) => path === "/api/lomi/webhook", rule: { windowMs: 60_000, limit: 30 } },
  { test: (path) => path.startsWith("/api/admin/"), rule: { windowMs: 60_000, limit: 90 } },
  { test: (path) => path.startsWith("/api/ai/"), rule: { windowMs: 60_000, limit: 80 } },
  { test: (path) => path.startsWith("/api/"), rule: { windowMs: 60_000, limit: 120 } },
];

function resolveRule(pathname: string): RateLimitRule | null {
  for (const { test, rule } of RATE_LIMIT_RULES) {
    if (test(pathname)) return rule;
  }
  return null;
}

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

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

export function checkRateLimit(request: NextRequest): RateLimitResult | null {
  const rule = resolveRule(request.nextUrl.pathname);
  if (!rule) return null;

  const now = Date.now();
  const windowStart = now - rule.windowMs;
  const ip = getClientIp(request);
  const key = `${request.nextUrl.pathname}:${ip}`;
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

export function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Clerk OAuth popups need allow-popups; strict same-origin breaks sign-in flows in some browsers.
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Do NOT add a script-src nonce unless every inline script (Next.js hydration, Clerk) carries it.
  // With a nonce present, browsers ignore 'unsafe-inline', which blocks Next/Clerk boot → stuck loaders.
  // See: https://github.com/clerk/javascript/issues/4455
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      [
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "https://*.clerk.accounts.dev",
        "https://*.clerk.com",
        "https://clerk.com",
        "https://challenges.cloudflare.com",
        "https://*.js.stripe.com",
        "https://js.stripe.com",
      ].join(" "),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: https://img.clerk.com",
      "font-src 'self' data: https:",
      [
        "connect-src 'self' https:",
        "https://*.clerk.accounts.dev",
        "https://*.clerk.com",
        "https://clerk.com",
        "https://clerk-telemetry.com",
        "https://*.clerk-telemetry.com",
      ].join(" "),
      "worker-src 'self' blob:",
      [
        "frame-src 'self'",
        "https://*.clerk.accounts.dev",
        "https://*.clerk.com",
        "https://clerk.com",
        "https://challenges.cloudflare.com",
        "https://*.js.stripe.com",
        "https://js.stripe.com",
        "https://hooks.stripe.com",
      ].join(" "),
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.clerk.accounts.dev https://*.clerk.com",
    ].join("; ")
  );
  return response;
}

export function attachRateLimitHeaders(response: NextResponse, result: RateLimitResult | null): NextResponse {
  if (!result) return response;
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  if (!result.allowed) {
    response.headers.set("Retry-After", String(result.retryAfterSeconds));
  }
  return response;
}
