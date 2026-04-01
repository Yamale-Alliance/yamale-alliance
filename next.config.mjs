/** @type {import('next').NextConfig} */
const supabaseHostname =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string"
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : "fitqojixvjbthsxignka.supabase.co";

const nextConfig = {
  experimental: {
    // Load CSS in import order so preloaded chunks are used when needed (reduces "preloaded but not used" warnings)
    cssChunking: "strict",
    // Allow larger multipart uploads for admin PDF ingestion routes.
    proxyClientMaxBodySize: 50 * 1024 * 1024, // 50MB
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
