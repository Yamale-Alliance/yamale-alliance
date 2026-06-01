import { NextRequest, NextResponse } from "next/server";
import { getClerkCspHosts } from "@/lib/clerk-csp-hosts";
import { getGoogleAnalyticsCspHosts } from "@/lib/google-analytics-csp";
import { checkDistributedRateLimit } from "@/lib/distributed-rate-limit";
import type { RateLimitResult } from "@/lib/runtime-security-types";

export type { RateLimitResult } from "@/lib/runtime-security-types";

export type RateLimitContext = {
  userId?: string | null;
};

/**
 * API rate limits — Upstash Redis when `UPSTASH_REDIS_REST_*` is set, else per-instance memory (dev only).
 */
export async function checkRateLimit(
  request: NextRequest,
  ctx: RateLimitContext = {}
): Promise<RateLimitResult | null> {
  return checkDistributedRateLimit(request, ctx);
}

export function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  const clerkHosts = getClerkCspHosts();
  const gaCsp = getGoogleAnalyticsCspHosts();
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      [
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        ...clerkHosts,
        "https://challenges.cloudflare.com",
        "https://*.js.stripe.com",
        "https://js.stripe.com",
        ...(gaCsp?.scriptSrc ?? []),
      ].join(" "),
      "style-src 'self' 'unsafe-inline'",
      [
        "img-src 'self' data: blob: https: https://img.clerk.com",
        ...(gaCsp?.imgSrc ?? []),
      ].join(" "),
      "media-src 'self' blob: https://res.cloudinary.com",
      "font-src 'self' data: https:",
      [
        "connect-src 'self' https:",
        ...clerkHosts,
        "https://clerk-telemetry.com",
        "https://*.clerk-telemetry.com",
        ...(gaCsp?.connectSrc ?? []),
      ].join(" "),
      "worker-src 'self' blob:",
      [
        "frame-src 'self'",
        ...clerkHosts,
        "https://challenges.cloudflare.com",
        "https://*.js.stripe.com",
        "https://js.stripe.com",
        "https://hooks.stripe.com",
      ].join(" "),
      "frame-ancestors 'none'",
      "base-uri 'self'",
      ["form-action 'self' mailto:", ...clerkHosts].join(" "),
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
