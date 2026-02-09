import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PATCH: set approved (show/hide in public directory). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid lawyer id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const approved = body.approved;
  if (typeof approved !== "boolean") {
    return NextResponse.json({ error: "approved (boolean) required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { error } = await (supabase.from("lawyers") as any)
    .update({ approved, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Admin lawyers directory PATCH error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, approved });
}

/** DELETE: remove lawyer from directory. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid lawyer id" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { error } = await (supabase.from("lawyers") as any).delete().eq("id", id);

  if (error) {
    console.error("Admin lawyers directory DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
