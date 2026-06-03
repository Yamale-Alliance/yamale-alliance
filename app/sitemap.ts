import type { MetadataRoute } from "next";
import { SITEMAP_PATHS, getSiteUrl } from "@/lib/site-seo";
import { fetchSitemapLawPaths, fetchSitemapMarketplacePaths } from "@/lib/sitemap-content-urls";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = SITEMAP_PATHS.map(
    ({ path, changeFrequency, priority }) => ({
      url: `${base}${path === "/" ? "" : path}`,
      lastModified,
      changeFrequency,
      priority,
    })
  );

  let lawPaths: string[] = [];
  let marketplacePaths: string[] = [];
  try {
    [lawPaths, marketplacePaths] = await Promise.all([
      fetchSitemapLawPaths(),
      fetchSitemapMarketplacePaths(),
    ]);
  } catch (err) {
    console.error("sitemap: dynamic content URLs skipped:", err);
  }

  const lawEntries: MetadataRoute.Sitemap = lawPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const marketplaceEntries: MetadataRoute.Sitemap = marketplacePaths.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  return [...staticEntries, ...lawEntries, ...marketplaceEntries];
}
