import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

type AuditLogRow = {
  id: string;
  admin_email: string | null;
  action: string;
  entity_id: string | null;
  details: { fields?: string[]; title?: string; restored?: boolean } | null;
  created_at: string;
};
type LawTitleRow = { id: string; title: string | null };

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 25, 1), 100);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const supabase = getSupabaseServer();
    const { data, error, count } = await supabase
      .from("admin_audit_log")
      .select("id, admin_email, action, entity_id, details, created_at", { count: "exact" })
      .eq("action", "law.update")
      .eq("entity_type", "law")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entries = (data ?? []) as AuditLogRow[];
    const lawIds = Array.from(new Set(entries.map((e) => e.entity_id).filter((id): id is string => typeof id === "string" && id.length > 0)));

    const [activeRes, deletedRes] = await Promise.all([
      lawIds.length > 0
        ? supabase.from("laws").select("id, title").in("id", lawIds)
        : Promise.resolve({ data: [], error: null }),
      lawIds.length > 0
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from("deleted_laws") as any).select("id, title").in("id", lawIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const activeRows = (activeRes.data ?? []) as LawTitleRow[];
    const deletedRows = (deletedRes.data ?? []) as LawTitleRow[];
    const titleById = new Map<string, string>();
    for (const row of activeRows) {
      titleById.set(row.id, row.title ?? "(untitled)");
    }
    for (const row of deletedRows) {
      if (!titleById.has(row.id)) titleById.set(row.id, row.title ?? "(untitled)");
    }

    const normalized = entries.map((e) => {
      const fields = Array.isArray(e.details?.fields) ? e.details?.fields : [];
      const title = (e.entity_id && titleById.get(e.entity_id)) || e.details?.title || "(unknown law)";
      return {
        id: e.id,
        law_id: e.entity_id,
        law_title: title,
        changed_fields: fields,
        restored: !!e.details?.restored,
        admin_email: e.admin_email,
        created_at: e.created_at,
      };
    });

    return NextResponse.json({ entries: normalized, total: typeof count === "number" ? count : 0 });
  } catch (err) {
    console.error("Admin recent law updates GET error:", err);
    return NextResponse.json({ error: "Failed to load recently updated laws" }, { status: 500 });
  }
}

