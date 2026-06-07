import { NextResponse } from "next/server";
import { readStaticFaviconResponse } from "@/lib/site-favicon-static";

export const dynamic = "force-dynamic";

/** Serves a stable same-origin /favicon.ico from public/favicon.ico. */
export async function GET() {
  const staticIco = await readStaticFaviconResponse();
  if (staticIco) return staticIco;
  return new NextResponse(null, { status: 404 });
}
