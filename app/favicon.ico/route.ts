import { NextRequest, NextResponse } from "next/server";
import { fetchBrandingFaviconResponse } from "@/lib/site-favicon";

export const dynamic = "force-dynamic";

/** Serves admin-uploaded favicon at /favicon.ico (no redirect — avoids GSC "page with redirect"). */
export async function GET(request: NextRequest) {
  const branded = await fetchBrandingFaviconResponse();
  if (branded) return branded;

  return NextResponse.rewrite(new URL("/icon", request.url));
}
