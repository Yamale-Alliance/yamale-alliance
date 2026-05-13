import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isBlockedAiScraperRequest } from "@/lib/ai-scraper-guard";
import {
  applySecurityHeaders,
  attachRateLimitHeaders,
  checkRateLimit,
} from "@/lib/runtime-security";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/signup(.*)",
  "/pricing(.*)",
  "/library(.*)",
  "/afcfta(.*)",
  "/ai-research(.*)",
  "/marketplace(.*)",
  "/lawyers(.*)",
  "/api/laws(.*)", // public laws API for Library
  "/api/pricing", // public pricing data for pricing page
  "/api/marketplace(.*)", // public marketplace list and detail
  "/api/lomi/webhook", // Lomi + pawaPay payment callbacks (verified by signature where configured)
]);

// Basic HTTP Authentication
function checkBasicAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  const encoded = authHeader.substring(6);
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  const [username, password] = decoded.split(":");

  const expectedUsername = process.env.BASIC_AUTH_USERNAME || "yamale";
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD || "demo2024";

  return username === expectedUsername && password === expectedPassword;
}

export default clerkMiddleware(async (auth, request) => {
  if (isBlockedAiScraperRequest(request)) {
    const forbidden = new NextResponse(
      "Automated access to this content is not permitted. If you are a human user, please open this page in a standard browser without an AI training crawler user agent.",
      {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }
    );
    return applySecurityHeaders(forbidden);
  }

  const rateLimit = checkRateLimit(request);
  if (rateLimit && !rateLimit.allowed) {
    const limited = NextResponse.json(
      { error: "Too many requests. Please slow down and retry." },
      { status: 429 }
    );
    return applySecurityHeaders(attachRateLimitHeaders(limited, rateLimit));
  }

  // Basic HTTP Auth check (only if enabled via env var)
  // Skip basic auth for public laws API so Library works without sign-in (incl. on mobile)
  const url = request.nextUrl ?? new URL(request.url);
  const isPublicApi = 
    request.method === "GET" &&
    (url.pathname === "/api/laws" ||
      url.pathname.startsWith("/api/laws/") ||
      url.pathname === "/api/pricing");
  const isWebhookCallback =
    url.pathname === "/api/lomi/webhook";
  if (process.env.ENABLE_BASIC_AUTH === "true" && !isPublicApi && !isWebhookCallback) {
    if (!checkBasicAuth(request)) {
      const unauthorized = new NextResponse("Authentication required", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Yamalé Legal Platform"',
        },
      });
      return applySecurityHeaders(attachRateLimitHeaders(unauthorized, rateLimit));
    }
  }

  // Clerk authentication
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  const response = NextResponse.next();
  return applySecurityHeaders(attachRateLimitHeaders(response, rateLimit));
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
