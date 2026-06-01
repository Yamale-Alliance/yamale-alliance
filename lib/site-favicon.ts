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

/** Metadata.icons — Cloudinary URL when set (absolute, works on localhost); else /favicon.ico route. */
export function buildFaviconMetadataIcons(faviconUrl?: string | null) {
  const trimmed = faviconUrl?.trim();
  if (trimmed) {
    const type = trimmed.toLowerCase().includes(".ico") ? "image/x-icon" : "image/png";
    return {
      icon: [
        { url: trimmed, type },
        { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
      ],
      shortcut: [trimmed, "/favicon.ico"],
      apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
    };
  }
  return {
    icon: [{ url: "/favicon.ico", type: "image/x-icon", sizes: "any" }],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  };
}
