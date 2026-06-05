import { NextRequest, NextResponse } from "next/server";
import { getAdvisoryWorkspaceAccess } from "@/lib/law-firm-development/access-server";

/** GET: workspace access for optional ?course= slug or id. */
export async function GET(request: NextRequest) {
  const courseKey = request.nextUrl.searchParams.get("course");
  const access = await getAdvisoryWorkspaceAccess(courseKey);
  return NextResponse.json(
    { access },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
