import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";

const MAX_BATCH = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** POST: delete multiple laws (admin only). Body: { ids: string[] } */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  const ids = [
    ...new Set(
      raw
        .map((id) => String(id).trim())
        .filter((id) => UUID_RE.test(id))
    ),
  ];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No valid law ids" }, { status: 400 });
  }
  if (ids.length > MAX_BATCH) {
    return NextResponse.json({ error: `Maximum ${MAX_BATCH} laws per request` }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const { data: existing, error: fetchErr } = await supabase
      .from("laws")
      .select("id, title")
      .in("id", ids);

    if (fetchErr) {
      console.error("Admin laws batch-delete fetch:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const rows = (existing ?? []) as { id: string; title: string }[];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0, notFound: ids });
    }

    const foundIds = rows.map((r) => r.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: delErr } = await (supabase.from("laws") as any).delete().in("id", foundIds);

    if (delErr) {
      console.error("Admin laws batch-delete:", delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    const notFound = ids.filter((id) => !foundIds.includes(id));

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "law.delete_batch",
      entityType: "law",
      entityId: null,
      details: {
        count: rows.length,
        ids: foundIds,
        titles: rows.map((r) => r.title).slice(0, 100),
      },
    });

    return NextResponse.json({
      ok: true,
      deleted: rows.length,
      ...(notFound.length > 0 ? { notFound } : {}),
    });
  } catch (err) {
    console.error("Admin laws batch-delete error:", err);
    return NextResponse.json({ error: "Failed to delete laws" }, { status: 500 });
  }
}
