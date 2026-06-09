import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  adminHasValidStepUpFromRequest,
  isAdminMfaExemptPath,
} from "@/lib/admin-mfa-gate";
import { isAdminMfaEnforced, userHasAdminAccess } from "@/lib/admin-session";
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
  "/library(.*)", // page shows sign-in prompt; laws API requires Clerk session
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

  const authState = await auth();
  const { userId } = authState;

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
  if (!isPublicRoute(request) && !isAiEvalChat) {
    await auth.protect();
  }

  const needsAdminAccess = isAdminPanelPage(request) || isAdminApiRoute(request);
  if (needsAdminAccess) {
    const isAdmin = await userHasAdminAccess(authState);
    if (isAdminPanelPage(request) && !isAdmin) {
      return applySecurityHeaders(
        attachRateLimitHeaders(NextResponse.redirect(new URL("/dashboard", request.url)), rateLimit)
      );
    }
    if (isAdminApiRoute(request) && !isAdmin) {
      const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return applySecurityHeaders(attachRateLimitHeaders(forbidden, rateLimit));
    }

    if (isAdmin && isAdminMfaEnforced() && !isAdminMfaExemptPath(url.pathname)) {
      const stepUpOk = userId ? adminHasValidStepUpFromRequest(request, userId) : false;
      if (!stepUpOk) {
        if (isAdminPanelPage(request)) {
          const mfaUrl = new URL("/admin-panel/mfa", request.url);
          mfaUrl.searchParams.set("returnTo", `${url.pathname}${url.search}`);
          return applySecurityHeaders(
            attachRateLimitHeaders(NextResponse.redirect(mfaUrl), rateLimit)
          );
        }
        const mfaRequired = NextResponse.json(
          { error: "MFA required", code: "MFA_REQUIRED" },
          { status: 403 }
        );
        return applySecurityHeaders(attachRateLimitHeaders(mfaRequired, rateLimit));
      }
    }
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
