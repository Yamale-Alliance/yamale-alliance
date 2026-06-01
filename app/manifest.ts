import type { MetadataRoute } from "next";
import { SITE, getSiteUrl } from "@/lib/site-seo";
import { getPlatformFavicon } from "@/lib/platform-settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const base = getSiteUrl();
  const faviconUrl = await getPlatformFavicon();

  const icons: MetadataRoute.Manifest["icons"] = faviconUrl
    ? [
        {
          src: `${base}/icon`,
          sizes: "48x48",
          type: "image/x-icon",
          purpose: "any",
        },
        {
          src: `${base}/apple-icon`,
          sizes: "180x180",
          type: "image/png",
          purpose: "any",
        },
      ]
    : [
        {
          src: `${base}/icon`,
          sizes: "48x48",
          type: "image/x-icon",
          purpose: "any",
        },
      ];

  return {
    id: "/",
    name: SITE.name,
    short_name: SITE.shortName,
    description: SITE.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0d1b2a",
    theme_color: "#0d1b2a",
    categories: ["legal", "education", "productivity", "business"],
    lang: SITE.locale,
    dir: "ltr",
    icons,
  };
}
