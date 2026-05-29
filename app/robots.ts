import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-seo";

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
  const baseUrl = getSiteUrl();

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

  return {
    rules,
    host: new URL(baseUrl).host,
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
