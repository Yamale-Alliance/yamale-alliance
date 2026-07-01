import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  inspectStepUpFromRequest,
  isAdminMfaExemptPath,
  isAdminMfaRequired,
} from "@/lib/admin-mfa-gate";
import { getUserAdminPanelRole } from "@/lib/admin-session";
import { getAdminSecuritySettings } from "@/lib/admin-security-settings";
import { ADMIN_MFA_COOKIE_NAME, adminMfaCookieSerializeOptions } from "@/lib/admin-mfa-session";
import {
  isLegalAdminAllowedApiPath,
  isLegalAdminAllowedPanelPath,
  isLegalAdminRole,
} from "@/lib/admin-roles";
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
  "/founders-note(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/payment-refund(.*)",
  "/contact(.*)",
  "/icon",
  "/apple-icon",
  "/opengraph-image(.*)",
  "/sitemap.xml",
  "/robots.txt",
  "/llms.txt",
  "/library(.*)", // browse is public; sign-in prompt on law open
  "/afcfta(.*)",
  "/ai-research(.*)",
  "/ai-legal-search-africa(.*)",
  "/ohada-ai-legal-research(.*)",
  "/afcfta-ai-legal-research(.*)",
  "/african-legal-library-ai(.*)",
  "/marketplace(.*)",
  "/lawyers(.*)",
  "/api/pricing", // public pricing data for pricing page
  "/api/marketplace(.*)", // public marketplace list and detail
  "/api/lomi/webhook", // Lomi (X-Lomi-Signature) + pawaPay callbacks — public; do not require Clerk or X-API-Key here
  "/api/payments/webhook", // legacy docs URL; same handler as /api/lomi/webhook
  "/api/stripe/webhook", // legacy Stripe-era URL; pawaPay may still POST here (not Stripe)
  "/api/cron/(.*)", // secured with CRON_SECRET inside each handler
]);

const isAdminPanelPage = createRouteMatcher(["/admin-panel(.*)"]);
const isAdminApiRoute = createRouteMatcher(["/api/admin(.*)"]);

/** Public catalog GET — skip Clerk session probe in middleware (saves ~1s); route/page call auth() when needed. */
function isPublicMarketplaceCatalogGet(request: Request): boolean {
  if (request.method !== "GET") return false;
  const pathname = new URL(request.url).pathname;
  return pathname === "/api/marketplace" || pathname === "/api/pricing";
}

/** Public library list GET only — law detail/summary routes enforce session in handlers. */
function isPublicLibraryLawsListGet(request: Request): boolean {
  if (request.method !== "GET") return false;
  return new URL(request.url).pathname === "/api/laws";
}

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

const CANONICAL_SITE_ORIGIN = "https://yamalelegal.com";

export default clerkMiddleware(async (auth, request) => {
  const url = request.nextUrl ?? new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  if (host.includes("vercel.app")) {
    const dest = new URL(`${url.pathname}${url.search}`, CANONICAL_SITE_ORIGIN);
    return NextResponse.redirect(dest, 308);
  }

  const skipClerkSessionProbe =
    isPublicMarketplaceCatalogGet(request) || isPublicLibraryLawsListGet(request);
  const authState = skipClerkSessionProbe ? null : await auth();
  const userId = authState?.userId ?? null;

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

  const rateLimit = await checkRateLimit(request, { userId });
  if (rateLimit && !rateLimit.allowed) {
    const limited = NextResponse.json(
      { error: "Too many requests. Please slow down and retry." },
      { status: 429 }
    );
    return applySecurityHeaders(attachRateLimitHeaders(limited, rateLimit));
  }

  // Basic HTTP Auth check (only if enabled via env var)
  const isPublicApi =
    request.method === "GET" && url.pathname === "/api/pricing";
  const isWebhookCallback =
    url.pathname === "/api/lomi/webhook" ||
    url.pathname === "/api/payments/webhook" ||
    url.pathname === "/api/stripe/webhook";
  const isCronRoute = url.pathname.startsWith("/api/cron/");
  const isAiEvalChat =
    request.method === "POST" &&
    url.pathname === "/api/ai/chat" &&
    (() => {
      const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
      const secret = process.env.AI_EVAL_SECRET?.trim();
      return Boolean(bearer && secret && bearer === secret);
    })();
  if (
    process.env.ENABLE_BASIC_AUTH === "true" &&
    !isPublicApi &&
    !isWebhookCallback &&
    !isCronRoute &&
    !isAiEvalChat
  ) {
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

  // Clerk authentication (batch eval uses AI_EVAL_SECRET + AI_EVAL_CLERK_USER_ID on POST /api/ai/chat)
  if (!isPublicRoute(request) && !isAiEvalChat && !isPublicLibraryLawsListGet(request)) {
    await auth.protect();
  }

  let refreshedStepUpToken: string | null = null;
  const needsAdminAccess = isAdminPanelPage(request) || isAdminApiRoute(request);
  if (needsAdminAccess) {
    if (!authState) {
      const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return applySecurityHeaders(attachRateLimitHeaders(forbidden, rateLimit));
    }
    const panelRole = await getUserAdminPanelRole(authState);
    const hasPanelAccess = panelRole !== null;
    const pathname = url.pathname;

    if (isAdminPanelPage(request) && !hasPanelAccess) {
      return applySecurityHeaders(
        attachRateLimitHeaders(NextResponse.redirect(new URL("/dashboard", request.url)), rateLimit)
      );
    }
    if (isAdminApiRoute(request) && !hasPanelAccess) {
      const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return applySecurityHeaders(attachRateLimitHeaders(forbidden, rateLimit));
    }

    if (hasPanelAccess && isLegalAdminRole(panelRole)) {
      if (isAdminPanelPage(request) && !isLegalAdminAllowedPanelPath(pathname)) {
        const lawsUrl = new URL("/admin-panel/laws", request.url);
        return applySecurityHeaders(
          attachRateLimitHeaders(NextResponse.redirect(lawsUrl), rateLimit)
        );
      }
      if (
        isAdminApiRoute(request) &&
        !isLegalAdminAllowedApiPath(pathname, request.method)
      ) {
        const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
        return applySecurityHeaders(attachRateLimitHeaders(forbidden, rateLimit));
      }
    }

    if (hasPanelAccess && isAdminMfaRequired() && !isAdminMfaExemptPath(pathname)) {
      const { mfaIdleTimeoutSec } = await getAdminSecuritySettings();
      const result = userId
        ? inspectStepUpFromRequest(request, userId, mfaIdleTimeoutSec)
        : { status: { valid: false as const, reason: "malformed" as const }, refreshedToken: null };

      if (!result.status.valid) {
        const idleExpired = result.status.reason === "idle_expired";
        if (isAdminPanelPage(request)) {
          const mfaUrl = new URL("/admin-panel/mfa", request.url);
          mfaUrl.searchParams.set("returnTo", `${url.pathname}${url.search}`);
          if (idleExpired) mfaUrl.searchParams.set("reason", "expired");
          const redirect = NextResponse.redirect(mfaUrl);
          // Drop the stale step-up cookie so the client state is clean.
          redirect.cookies.set(ADMIN_MFA_COOKIE_NAME, "", {
            ...adminMfaCookieSerializeOptions(0),
            maxAge: 0,
          });
          return applySecurityHeaders(attachRateLimitHeaders(redirect, rateLimit));
        }
        const mfaRequired = NextResponse.json(
          {
            error: idleExpired ? "MFA session expired" : "MFA required",
            code: idleExpired ? "MFA_SESSION_EXPIRED" : "MFA_REQUIRED",
          },
          { status: 403 }
        );
        return applySecurityHeaders(attachRateLimitHeaders(mfaRequired, rateLimit));
      }

      // Valid step-up: slide the idle window forward for this activity.
      refreshedStepUpToken = result.refreshedToken;
    }
  }

  const response = NextResponse.next();
  if (refreshedStepUpToken) {
    response.cookies.set(
      ADMIN_MFA_COOKIE_NAME,
      refreshedStepUpToken,
      adminMfaCookieSerializeOptions()
    );
  }
  return applySecurityHeaders(attachRateLimitHeaders(response, rateLimit));
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
