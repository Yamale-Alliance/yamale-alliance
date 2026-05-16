/** @type {import('next').NextConfig} */
const supabaseHostname =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string"
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : "fitqojixvjbthsxignka.supabase.co";

const nextConfig = {
  async rewrites() {
    // Legacy namespace: most `/api/stripe/*` paths map to `/api/payments/*`. Webhook has its own route file (pawaPay/Lomi, not Stripe).
    return [
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

export default nextConfig;
