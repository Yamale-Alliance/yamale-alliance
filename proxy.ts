import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
  "/api/stripe/webhook", // Stripe webhooks (verified by signature)
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
  // Basic HTTP Auth check (only if enabled via env var)
  // Skip basic auth for public laws API so Library works without sign-in (incl. on mobile)
  const url = request.nextUrl ?? new URL(request.url);
  const isPublicApi =
    request.method === "GET" &&
    (url.pathname === "/api/laws" ||
      url.pathname.startsWith("/api/laws/") ||
      url.pathname === "/api/pricing");
  if (process.env.ENABLE_BASIC_AUTH === "true" && !isPublicApi) {
    if (!checkBasicAuth(request)) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Yamalé Legal Platform"',
        },
      });
    }
  }

  // Clerk authentication
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
