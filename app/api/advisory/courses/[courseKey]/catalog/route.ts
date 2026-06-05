import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAdvisoryWorkspaceAccess } from "@/lib/law-firm-development/access-server";
import {
  loadAdvisoryCourseCatalog,
  resolveMarketplaceCourseItem,
} from "@/lib/advisory-course-catalog";

/** GET: course programme structure for the signed-in purchaser (or preview). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseKey: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { courseKey } = await params;
    const item = await resolveMarketplaceCourseItem(courseKey);
    if (!item) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const access = await getAdvisoryWorkspaceAccess(courseKey);
    if (!access.hasPackage) {
      return NextResponse.json({ error: "Package required" }, { status: 403 });
    }

    const catalog = await loadAdvisoryCourseCatalog(item.id);
    return NextResponse.json(
      {
        course: {
          id: catalog.item.id,
          slug: catalog.item.slug,
          title: catalog.item.title,
        },
        phases: catalog.phases,
        totalDocuments: catalog.totalDocuments,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("Advisory course catalog error:", err);
    return NextResponse.json({ error: "Failed to load catalog" }, { status: 500 });
  }
}
