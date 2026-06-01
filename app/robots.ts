import type { MetadataRoute } from "next";
import { AI_CRAWLER_USER_AGENTS, SEO_DISALLOW_PATHS } from "@/lib/seo-crawlers";
import { getSiteUrl } from "@/lib/site-seo";

const DISALLOW = [...SEO_DISALLOW_PATHS];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  const rules: MetadataRoute.Robots["rules"] = [
    {
      userAgent: "*",
      allow: "/",
      disallow: DISALLOW,
    },
    ...AI_CRAWLER_USER_AGENTS.map((userAgent) => ({
      userAgent,
      allow: "/",
      disallow: DISALLOW,
    })),
  ];

  return {
    rules,
    host: new URL(baseUrl).host,
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
