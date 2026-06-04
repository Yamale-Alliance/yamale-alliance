import { getPlatformBranding } from "@/lib/platform-branding";

const FAVICON_REVALIDATE_SEC = 300;

/** Fetch favicon bytes from admin branding (Cloudinary). */
export async function fetchBrandingFaviconResponse(): Promise<Response | null> {
  const { faviconUrl: url } = await getPlatformBranding();
  if (!url?.trim()) return null;

  try {
    const res = await fetch(url.trim(), {
      cache: "no-store",
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

/** Metadata.icons — static ≥48×48 assets plus optional admin Cloudinary override. */
export function buildFaviconMetadataIcons(faviconUrl?: string | null) {
  const staticIcons = [
    { url: "/favicon.ico", type: "image/x-icon", sizes: "48x48" },
    { url: "/favicon-192.png", type: "image/png", sizes: "192x192" },
  ];
  const apple = [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }];

  const trimmed = faviconUrl?.trim();
  if (trimmed) {
    const type = trimmed.toLowerCase().includes(".ico") ? "image/x-icon" : "image/png";
    return {
      // Static /favicon.ico first so Google and other crawlers get a stable same-origin icon.
      icon: [...staticIcons, { url: trimmed, type }],
      shortcut: ["/favicon.ico", trimmed],
      apple,
    };
  }
  return {
    icon: staticIcons,
    shortcut: ["/favicon.ico"],
    apple,
  };
}
