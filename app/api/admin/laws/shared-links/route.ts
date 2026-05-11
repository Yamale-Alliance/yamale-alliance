import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import {
  fetchSharedGroupForLaw,
  propagateLawCategoriesAcrossSharedGroup,
  propagateSharedLawFields,
} from "@/lib/law-shared-groups";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeLawIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => UUID_RE.test(v));
  return Array.from(new Set(ids));
}

/** GET: inspect shared-law group for a law id (admin only). */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const lawId = request.nextUrl.searchParams.get("lawId")?.trim() || "";
  if (!UUID_RE.test(lawId)) {
    return NextResponse.json({ error: "Valid lawId query parameter is required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const group = await fetchSharedGroupForLaw(supabase, lawId);
    if (!group) {
      return NextResponse.json({ linked: false, group: null });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: laws, error } = await (supabase as any)
      .from("laws")
      .select("id, title, country_id, applies_to_all_countries, updated_at")
      .in("id", group.lawIds)
      .order("title");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: groupRow } = await (supabase as any)
      .from("law_shared_groups")
      .select("id, name, created_at, updated_at")
      .eq("id", group.groupId)
      .maybeSingle();

    return NextResponse.json({
      linked: true,
      group: {
        ...(groupRow ?? { id: group.groupId, name: null }),
        law_ids: group.lawIds,
        laws: laws ?? [],
      },
    });
  } catch (err) {
    console.error("Shared links GET error:", err);
    return NextResponse.json({ error: "Failed to fetch shared links" }, { status: 500 });
  }
}

/**
 * POST: manually create a shared-law group for multiple country variants.
 * Body: { lawIds: string[], groupName?: string, sourceLawId?: string, propagateNow?: boolean }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json().catch(() => ({}));
    const lawIds = normalizeLawIds(body.lawIds);
    const groupName = typeof body.groupName === "string" ? body.groupName.trim() : "";
    const propagateNow = body.propagateNow !== false;
    const sourceLawIdRaw = typeof body.sourceLawId === "string" ? body.sourceLawId.trim() : "";
    const sourceLawId = UUID_RE.test(sourceLawIdRaw) ? sourceLawIdRaw : lawIds[0];

    if (lawIds.length < 2) {
      return NextResponse.json({ error: "Provide at least 2 valid lawIds to link." }, { status: 400 });
    }
    if (!sourceLawId || !lawIds.includes(sourceLawId)) {
      return NextResponse.json({ error: "sourceLawId must be one of lawIds." }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingLaws, error: lawsErr } = await (supabase as any)
      .from("laws")
      .select("id")
      .in("id", lawIds);
    if (lawsErr) {
      return NextResponse.json({ error: lawsErr.message }, { status: 500 });
    }
    const existingIds = new Set(((existingLaws ?? []) as Array<{ id: string }>).map((l) => l.id));
    const missing = lawIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json({ error: "Some laws do not exist.", missing_law_ids: missing }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: alreadyLinked } = await (supabase as any)
      .from("law_shared_group_members")
      .select("law_id, group_id")
      .in("law_id", lawIds);
    if ((alreadyLinked ?? []).length > 0) {
      return NextResponse.json(
        {
          error: "One or more selected laws are already linked to a shared group.",
          conflicts: alreadyLinked,
        },
        { status: 409 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: groupRow, error: groupErr } = await (supabase as any)
      .from("law_shared_groups")
      .insert({ name: groupName || null })
      .select("id, name, created_at, updated_at")
      .single();
    if (groupErr || !groupRow?.id) {
      return NextResponse.json({ error: groupErr?.message || "Failed to create shared group" }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: memberErr } = await (supabase as any)
      .from("law_shared_group_members")
      .insert(lawIds.map((lawId) => ({ group_id: groupRow.id, law_id: lawId })));
    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 500 });
    }

    if (propagateNow) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sourceLaw, error: sourceErr } = await (supabase as any)
        .from("laws")
        .select("title, category_id, year, status, treaty_type, source_url, source_name, content, content_plain")
        .eq("id", sourceLawId)
        .single();
      if (sourceErr || !sourceLaw) {
        return NextResponse.json({ error: sourceErr?.message || "Failed to load source law" }, { status: 500 });
      }

      const targets = lawIds.filter((id) => id !== sourceLawId);
      await propagateSharedLawFields(supabase, sourceLawId, targets, sourceLaw);
      await propagateLawCategoriesAcrossSharedGroup(supabase, sourceLawId, targets);
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "law.link_shared",
      entityType: "law_shared_group",
      entityId: groupRow.id,
      details: {
        source_law_id: sourceLawId,
        law_ids: lawIds,
        propagate_now: propagateNow,
      },
    });

    return NextResponse.json({
      ok: true,
      group: {
        id: groupRow.id,
        name: groupRow.name,
        created_at: groupRow.created_at,
        updated_at: groupRow.updated_at,
        law_ids: lawIds,
      },
      propagated_from: propagateNow ? sourceLawId : null,
    });
  } catch (err) {
    console.error("Shared links POST error:", err);
    return NextResponse.json({ error: "Failed to create shared links" }, { status: 500 });
  }
}
