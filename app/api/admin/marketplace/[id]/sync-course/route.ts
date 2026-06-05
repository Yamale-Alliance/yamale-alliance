import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { syncCourseModulesFromZip } from "@/lib/marketplace-course-sync";
import { recordAuditLog } from "@/lib/admin-audit";
import { getSupabaseServer } from "@/lib/supabase/server";

/** POST: import course modules from the item's ZIP file. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const result = await syncCourseModulesFromZip(id);
    const supabase = getSupabaseServer();
    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "marketplace_item.update",
      entityType: "marketplace_item",
      entityId: id,
      details: { courseModuleSync: true, moduleCount: result.count },
    });
    return NextResponse.json({
      ok: true,
      moduleCount: result.count,
      phaseCount: result.phaseCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
