import type { MetadataRoute } from "next";
import { SITE, getSiteUrl } from "@/lib/site-seo";

export default function manifest(): MetadataRoute.Manifest {
  const base = getSiteUrl();

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
    icons: [
      {
        src: `${base}/opengraph-image`,
        sizes: "1200x630",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
