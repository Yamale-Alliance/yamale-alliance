import { getPlatformFavicon } from "@/lib/platform-settings";

const FAVICON_REVALIDATE_SEC = 300;

/** Fetch favicon bytes from admin branding (Cloudinary). */
export async function fetchBrandingFaviconResponse(): Promise<Response | null> {
  const url = await getPlatformFavicon();
  if (!url?.trim()) return null;

  try {
    const res = await fetch(url.trim(), {
      next: { revalidate: FAVICON_REVALIDATE_SEC },
    });
    if (!res.ok) return null;
    const body = await res.arrayBuffer();
    const contentType =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "image/x-icon";
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${FAVICON_REVALIDATE_SEC}, s-maxage=${FAVICON_REVALIDATE_SEC}`,
      },
    });
  } catch {
    return null;
  }
}

/** Metadata.icons for root layout — same-origin routes Google and browsers crawl reliably. */
export function buildFaviconMetadataIcons(faviconUrl: string | null) {
  if (!faviconUrl?.trim()) {
    return {
      icon: [{ url: "/icon", type: "image/x-icon" }],
      shortcut: ["/icon"],
    };
  }

  return {
    icon: [
      { url: "/icon", type: "image/x-icon" },
      { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
      { url: faviconUrl.trim(), type: "image/x-icon" },
    ],
    shortcut: ["/favicon.ico", "/icon"],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  };
}
