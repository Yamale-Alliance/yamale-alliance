import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yamalé Legal Platform",
    short_name: "Yamalé",
    description:
      "African legal library, AI research, and professional network — law without barriers.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0d1b2a",
    theme_color: "#0d1b2a",
    categories: ["legal", "education", "productivity"],
    lang: "en",
    icons: [],
  };
}
