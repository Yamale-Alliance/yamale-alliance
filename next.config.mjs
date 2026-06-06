import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const supabaseHostname =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string"
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : "fitqojixvjbthsxignka.supabase.co";

const nextConfig = {
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
  experimental: {
    // Load CSS in import order so preloaded chunks are used when needed (reduces "preloaded but not used" warnings)
    cssChunking: "strict",
    // Allow larger multipart uploads for admin PDF ingestion routes.
    proxyClientMaxBodySize: 100 * 1024 * 1024, // 100MB
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

const hasSentry = Boolean(
  process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim()
);

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
