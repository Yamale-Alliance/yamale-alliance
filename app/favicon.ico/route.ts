import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { fetchBrandingFaviconResponse } from "@/lib/site-favicon";
import { STATIC_FAVICON_DISK } from "@/lib/site-favicon-static";

export const dynamic = "force-dynamic";
const FAVICON_CACHE = "public, max-age=86400, s-maxage=86400";

async function staticFaviconResponse(): Promise<NextResponse | null> {
  try {
    const body = await readFile(STATIC_FAVICON_DISK);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "image/x-icon",
        "Cache-Control": FAVICON_CACHE,
      },
    });
  } catch {
    return null;
  }
}

/** Serves a stable same-origin /favicon.ico (Google Search requires this; avoid redirect/dynamic-only). */
export async function GET() {
  const staticIco = await staticFaviconResponse();
  if (staticIco) return staticIco;

  const branded = await fetchBrandingFaviconResponse();
  if (branded) return branded;

  return new NextResponse(null, { status: 404 });
}
