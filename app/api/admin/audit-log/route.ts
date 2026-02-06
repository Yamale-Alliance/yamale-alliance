import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const offset = Number(searchParams.get("offset")) || 0;
    const adminId = searchParams.get("adminId") ?? undefined;
    const action = searchParams.get("action") ?? undefined;
    const entityType = searchParams.get("entityType") ?? undefined;

    const supabase = getSupabaseServer();
    let query = supabase
      .from("admin_audit_log")
      .select("id, admin_id, admin_email, action, entity_type, entity_id, details, created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (adminId) query = query.eq("admin_id", adminId);
    if (action) query = query.eq("action", action);
    if (entityType) query = query.eq("entity_type", entityType);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("Admin audit-log GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 }
    );
  }
}
