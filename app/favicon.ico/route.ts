import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { fetchBrandingFaviconResponse } from "@/lib/site-favicon";

export const dynamic = "force-dynamic";

const STATIC_FAVICON_PATH = path.join(process.cwd(), "public/favicon.ico");

/** Serves admin-uploaded favicon at /favicon.ico (no redirect — avoids GSC "page with redirect"). */
export async function GET(request: NextRequest) {
  const branded = await fetchBrandingFaviconResponse();
  if (branded) return branded;

  try {
    const body = await readFile(STATIC_FAVICON_PATH);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "image/x-icon",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return NextResponse.rewrite(new URL("/icon", request.url));
  }
}
