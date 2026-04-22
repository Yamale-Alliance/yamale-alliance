import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { Database } from "@/lib/database.types";

const ACTION_GROUPS: Record<string, string[]> = {
  create: ["law.add", "admin.add", "marketplace_item.add"],
  update: ["law.update", "pricing.update", "marketplace_item.update"],
  delete: ["law.delete", "law.delete_batch", "lawyer.removed", "marketplace_item.delete"],
  role: ["admin.role", "user.tier"],
};

type AuditAdminRow = Pick<
  Database["public"]["Tables"]["admin_audit_log"]["Row"],
  "admin_id" | "admin_email"
>;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const offset = Number(searchParams.get("offset")) || 0;
    const adminId = searchParams.get("adminId") ?? undefined;
    const adminEmail = searchParams.get("adminEmail") ?? undefined;
    const action = searchParams.get("action") ?? undefined;
    const actionGroup = searchParams.get("actionGroup") ?? undefined;
    const entityType = searchParams.get("entityType") ?? undefined;

    const supabase = getSupabaseServer();
    let query = supabase
      .from("admin_audit_log")
      .select("id, admin_id, admin_email, action, entity_type, entity_id, details, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (adminId) query = query.eq("admin_id", adminId);
    if (adminEmail) query = query.eq("admin_email", adminEmail.toLowerCase());
    if (action) query = query.eq("action", action);
    if (actionGroup && ACTION_GROUPS[actionGroup]) query = query.in("action", ACTION_GROUPS[actionGroup]);
    if (entityType) query = query.eq("entity_type", entityType);

    const [entriesRes, adminsRes] = await Promise.all([
      query,
      supabase
        .from("admin_audit_log")
        .select("admin_id, admin_email")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    const { data, error, count } = entriesRes;
    const { data: adminRows, error: adminsError } = adminsRes;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (adminsError) {
      return NextResponse.json({ error: adminsError.message }, { status: 500 });
    }

    const uniqueAdmins: { id: string; email: string | null }[] = [];
    const seen = new Set<string>();
    for (const row of (adminRows ?? []) as AuditAdminRow[]) {
      const id = row.admin_id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      uniqueAdmins.push({ id, email: row.admin_email ?? null });
    }

    return NextResponse.json({
      entries: data ?? [],
      total: typeof count === "number" ? count : 0,
      admins: uniqueAdmins,
    });
  } catch (err) {
    console.error("Admin audit-log GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 }
    );
  }
}
