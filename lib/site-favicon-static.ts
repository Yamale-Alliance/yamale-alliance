import { readFile } from "fs/promises";
import path from "path";

/** Primary tab icon — replace this file in the repo (served at /favicon.ico). */
export const STATIC_FAVICON_ICO = path.join(process.cwd(), "public", "favicon.ico");

/** Legacy fallback if favicon.ico is missing. */
export const STATIC_FAVICON_FALLBACK_ICO = path.join(process.cwd(), "public", "favicon-default.ico");

/** 192×192 PNG for manifest, JSON-LD, and some crawlers. */
export const STATIC_FAVICON_192 = path.join(process.cwd(), "public", "favicon-192.png");

/** 180×180 PNG for iOS home screen / apple-icon route. */
export const STATIC_APPLE_TOUCH_ICON = path.join(process.cwd(), "public", "apple-touch-icon.png");

const FAVICON_CACHE = "public, max-age=86400, s-maxage=86400";

async function readStaticFile(diskPath: string, contentType: string): Promise<Response | null> {
  try {
    const body = await readFile(diskPath);
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": FAVICON_CACHE,
      },
    });
  } catch {
    return null;
  }
}

/** Read public/favicon.ico, then favicon-default.ico. */
export async function readStaticFaviconResponse(): Promise<Response | null> {
  const primary = await readStaticFile(STATIC_FAVICON_ICO, "image/x-icon");
  if (primary) return primary;
  return readStaticFile(STATIC_FAVICON_FALLBACK_ICO, "image/x-icon");
}

export async function readStaticAppleTouchIconResponse(): Promise<Response | null> {
  return readStaticFile(STATIC_APPLE_TOUCH_ICON, "image/png");
}
