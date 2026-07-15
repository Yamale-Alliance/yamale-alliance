import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import { isLawTreatyType } from "@/lib/law-treaty-type";
import { isLawLevel } from "@/lib/law-level";
import type { Database } from "@/lib/database.types";

type LawBatchRow = Pick<
  Database["public"]["Tables"]["laws"]["Row"],
  "id" | "title" | "treaty_type" | "level"
>;

const MAX_BATCH = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST: update fields on multiple laws (admin only).
 * Body: { ids: string[], treaty_type?: string, level?: string }
 * At least one of treaty_type or level is required.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: { ids?: unknown; treaty_type?: unknown; level?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  const patch: { treaty_type?: string; level?: string } = {};
  const auditFields: { field: string; value: string }[] = [];

  if (body.treaty_type !== undefined && body.treaty_type !== null) {
    const treatyType = String(body.treaty_type).trim();
    if (!isLawTreatyType(treatyType)) {
      return NextResponse.json(
        { error: "Invalid treaty_type. Use Bilateral, Multilateral, or Not a treaty." },
        { status: 400 }
      );
    }
    patch.treaty_type = treatyType;
    auditFields.push({ field: "treaty_type", value: treatyType });
  }

  if (body.level !== undefined && body.level !== null) {
    const level = String(body.level).trim();
    if (!isLawLevel(level)) {
      return NextResponse.json(
        { error: "Invalid level. Use National, Regional, or International." },
        { status: 400 }
      );
    }
    patch.level = level;
    auditFields.push({ field: "level", value: level });
  }

  if (auditFields.length === 0) {
    return NextResponse.json(
      { error: "Provide treaty_type and/or level to update." },
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
      .select("id, title, treaty_type, level")
      .in("id", ids);

    if (fetchErr) {
      console.error("Admin laws batch-update fetch:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const rows = (existing ?? []) as LawBatchRow[];
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, updated: 0, notFound: ids });
    }

    const foundIds = rows.map((r) => r.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (supabase.from("laws") as any)
      .update(patch)
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
        fields: auditFields,
        count: rows.length,
        ids: foundIds,
        titles: rows.map((r) => r.title).slice(0, 100),
        previous_treaty_types: rows.map((r) => r.treaty_type ?? null).slice(0, 100),
        previous_levels: rows.map((r) => r.level ?? null).slice(0, 100),
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
