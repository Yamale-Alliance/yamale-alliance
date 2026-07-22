import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const supabaseHostname =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string"
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : "fitqojixvjbthsxignka.supabase.co";

const nextConfig = {
  // Sentry/OpenTelemetry: must resolve from project root (Turbopack external packages).
  serverExternalPackages: [
    "import-in-the-middle",
    "require-in-the-middle",
    "@sentry/nextjs",
    "@sentry/node",
    "@napi-rs/canvas",
    "pdfjs-dist",
  ],
  turbopack: {
    resolveAlias: {
      "next-intl/config": "./i18n/request.ts",
    },
  },
  async rewrites() {
    return [
      // Legacy namespace: most `/api/stripe/*` paths map to `/api/payments/*`. Webhook has its own route file (pawaPay/Lomi, not Stripe).
      { source: "/api/stripe/webhook", destination: "/api/lomi/webhook" },
      { source: "/api/stripe/:path*", destination: "/api/payments/:path*" },
    ];
  },
  async redirects() {
    return [
      { source: "/afcfta", destination: "/library", permanent: true },
      { source: "/afcfta/:path*", destination: "/library", permanent: true },
      { source: "/afcfta-ai-legal-research", destination: "/ai-research", permanent: true },
    ];
  },
  experimental: {
    // Load CSS in import order so preloaded chunks are used when needed (reduces "preloaded but not used" warnings)
    cssChunking: "strict",
    // Default proxy buffer is 10MB; raise for admin PDF uploads under ~4MB on the same request.
    proxyClientMaxBodySize: "100mb",
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "static.wixstatic.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**",
      },
    ],
  },
};

const hasSentry =
  Boolean(
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim()
  ) &&
  (process.env.NODE_ENV === "production" ||
    process.env.SENTRY_ENABLE_IN_DEV === "true");

/** @type {import('@sentry/nextjs').SentryBuildOptions} */
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  // Webpack-only (no-op under Turbopack); replaces deprecated top-level disableLogger / automaticVercelMonitors.
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: true,
  },
};

const configWithSentry = hasSentry
  ? withSentryConfig(nextConfig, sentryBuildOptions)
  : nextConfig;

/** next-intl must wrap last so Turbopack/Webpack resolveAlias for `next-intl/config` is preserved. */
export default withNextIntl(configWithSentry);
