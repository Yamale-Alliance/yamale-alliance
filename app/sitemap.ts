import type { MetadataRoute } from "next";
import { SITEMAP_PATHS, getSiteUrl } from "@/lib/site-seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const lastModified = new Date();

  return SITEMAP_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
