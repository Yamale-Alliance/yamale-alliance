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
        src: `${base}/favicon.ico`,
        sizes: "48x48",
        type: "image/x-icon",
        purpose: "any",
      },
      {
        src: `${base}/favicon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}/apple-touch-icon.png`,
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
