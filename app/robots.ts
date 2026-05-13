import type { MetadataRoute } from "next";

/**
 * Known AI / dataset crawlers used for model training or broad ingestion.
 * @see https://darkvisitors.com/ — keep list updated as new agents appear.
 */
const AI_TRAINING_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "Google-Extended",
  "CCBot",
  "anthropic-ai",
  "ClaudeBot",
  "Claude-Web",
  "Bytespider",
  "PerplexityBot",
  "Perplexity-User",
  "cohere-ai",
  "Diffbot",
  "Omgilibot",
  "omgili",
  "ImagesiftBot",
  "Applebot-Extended",
] as const;

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    typeof process.env.NEXT_PUBLIC_APP_URL === "string"
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
      : typeof process.env.VERCEL_URL === "string"
        ? `https://${process.env.VERCEL_URL}`
        : undefined;

  const rules: MetadataRoute.Robots["rules"] = [
    {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account/", "/admin-panel/", "/dashboard"],
    },
    ...AI_TRAINING_USER_AGENTS.map((userAgent) => ({
      userAgent,
      disallow: ["/"],
    })),
  ];

  const out: MetadataRoute.Robots = { rules };
  if (baseUrl) {
    try {
      out.host = new URL(baseUrl).host;
    } catch {
      /* ignore invalid URL */
    }
  }
  return out;
}
