import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import { isLawTreatyType } from "@/lib/law-treaty-type";
import type { Database } from "@/lib/database.types";

type LawTreatyRow = Pick<Database["public"]["Tables"]["laws"]["Row"], "id" | "title" | "treaty_type">;

const MAX_BATCH = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** POST: update fields on multiple laws (admin only). Body: { ids: string[], treaty_type: string } */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: { ids?: unknown; treaty_type?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  const treatyRaw = body.treaty_type;
  if (treatyRaw === undefined || treatyRaw === null) {
    return NextResponse.json({ error: "treaty_type is required" }, { status: 400 });
  }
  const treatyType = String(treatyRaw).trim();
  if (!isLawTreatyType(treatyType)) {
    return NextResponse.json(
      { error: "Invalid treaty_type. Use Bilateral, Multilateral, or Not a treaty." },
      { status: 400 }
    );
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
      .select("id, title, treaty_type")
      .in("id", ids);

    if (fetchErr) {
      console.error("Admin laws batch-update fetch:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const rows = (existing ?? []) as LawTreatyRow[];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, updated: 0, notFound: ids });
    }

    const foundIds = rows.map((r: LawTreatyRow) => r.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (supabase.from("laws") as any)
      .update({ treaty_type: treatyType })
      .in("id", foundIds);

    if (upErr) {
      console.error("Admin laws batch-update:", upErr);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const notFound = ids.filter((id) => !foundIds.includes(id));

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "law.update_batch",
      entityType: "law",
      entityId: null,
      details: {
        field: "treaty_type",
        value: treatyType,
        count: rows.length,
        ids: foundIds,
        titles: rows.map((r: LawTreatyRow) => r.title).slice(0, 100),
        previous_treaty_types: rows.map((r: LawTreatyRow) => r.treaty_type ?? null).slice(0, 100),
      },
    });

    return NextResponse.json({
      ok: true,
      updated: rows.length,
      ...(notFound.length > 0 ? { notFound } : {}),
    });
  } catch (err) {
    console.error("Admin laws batch-update error:", err);
    return NextResponse.json({ error: "Failed to update laws" }, { status: 500 });
  }
}
