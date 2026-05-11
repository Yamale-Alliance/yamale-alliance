import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import { isLawTreatyType } from "@/lib/law-treaty-type";
import type { Database } from "@/lib/database.types";
import { fetchCategoryIdsForLaw, syncLawCategories } from "@/lib/law-categories-sync";
import {
  fetchSharedGroupForLaw,
  propagateLawCategoriesAcrossSharedGroup,
  propagateSharedLawFields,
  toSharedLawUpdates,
} from "@/lib/law-shared-groups";

type LawRow = Database["public"]["Tables"]["laws"]["Row"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** GET: fetch a single law for admin editing (including full text). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing law id" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const fullSelect =
      "id, title, country_id, applies_to_all_countries, category_id, year, status, treaty_type, source_url, source_name, content, content_plain";
    const legacySelect =
      "id, title, country_id, applies_to_all_countries, category_id, year, status, source_url, source_name, content, content_plain";

    const { data, error } = await supabase
      .from("laws")
      .select(fullSelect)
      .eq("id", id)
      .single();

    if (error) {
      const missingTreatyColumn =
        error.message?.toLowerCase().includes("treaty_type") ||
        error.code === "PGRST204";
      if (missingTreatyColumn) {
        // Backward-compat: local DB may not have migration 064 yet.
        const legacyRes = await supabase.from("laws").select(legacySelect).eq("id", id).single();
        const legacyData = legacyRes.data as LawRow | null;
        const legacyError = legacyRes.error;
        if (legacyError || !legacyData) {
          return NextResponse.json({ error: "Law not found" }, { status: 404 });
        }
        const law = {
          ...legacyData,
          treaty_type: "Not a treaty",
        };
        let category_ids: string[] = law.category_id ? [law.category_id] : [];
        try {
          category_ids = await fetchCategoryIdsForLaw(supabase, id);
        } catch {
          /* law_categories table may not exist yet */
        }
        return NextResponse.json({ law: { ...law, category_ids }, warning: "Missing treaty_type column; run migration 064." });
      }
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Law not found" }, { status: 404 });
      }
      console.error("Admin law GET query error:", error);
      return NextResponse.json({ error: "Failed to load law" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Law not found" }, { status: 404 });
    }

    const law = data as LawRow;
    let category_ids: string[] = [law.category_id];
    try {
      category_ids = await fetchCategoryIdsForLaw(supabase, id);
    } catch {
      category_ids = law.category_id ? [law.category_id] : [];
    }
    return NextResponse.json({ law: { ...law, category_ids } });
  } catch (err) {
    console.error("Admin law GET error:", err);
    return NextResponse.json({ error: "Failed to load law" }, { status: 500 });
  }
}

/** PUT: update law metadata (title, country, category, year, status, source) and/or content. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing law id" }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseServer();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (!t) {
        return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
      }
      updates.title = t;
    }
    if (body.applies_to_all_countries === true) {
      updates.applies_to_all_countries = true;
      updates.country_id = null;
    } else if (body.applies_to_all_countries === false) {
      const cid =
        typeof body.country_id === "string" && body.country_id.trim()
          ? body.country_id.trim()
          : "";
      if (!cid) {
        return NextResponse.json(
          { error: "Select a country, or enable “All countries” for treaties and regional instruments." },
          { status: 400 }
        );
      }
      updates.applies_to_all_countries = false;
      updates.country_id = cid;
    } else if (body.country_id !== undefined) {
      const cid = body.country_id ? String(body.country_id).trim() : "";
      if (cid) {
        updates.country_id = cid;
        updates.applies_to_all_countries = false;
      }
    }
    const categoryIdsPayload = Array.isArray(body.category_ids)
      ? (body.category_ids as unknown[]).filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
      : null;

    if (body.category_id !== undefined && !(categoryIdsPayload && categoryIdsPayload.length > 0)) {
      updates.category_id = body.category_id || null;
    }
    if (body.year !== undefined) updates.year = body.year ? Number(body.year) : null;
    if (typeof body.status === "string") updates.status = body.status.trim() || "In force";
    if (body.treaty_type !== undefined) {
      const treatyType = body.treaty_type ? String(body.treaty_type).trim() : "";
      if (!isLawTreatyType(treatyType)) {
        return NextResponse.json({ error: "Invalid treaty type" }, { status: 400 });
      }
      updates.treaty_type = treatyType;
    }
    if (typeof body.source_url === "string") updates.source_url = body.source_url.trim() || null;
    if (typeof body.source_name === "string") updates.source_name = body.source_name.trim() || null;

    if (typeof body.content === "string") {
      const trimmed = body.content.trim() || null;
      updates.content = trimmed;
      updates.content_plain = trimmed;
    }

    const nonTsKeys = Object.keys(updates).filter((k) => k !== "updated_at");
    const hasLawColumnUpdates = nonTsKeys.length > 0;
    const hasCategorySync = Boolean(categoryIdsPayload && categoryIdsPayload.length > 0);

    if (!hasLawColumnUpdates && !hasCategorySync) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    let propagatedLawIds: string[] = [];
    const sharedGroup = await fetchSharedGroupForLaw(supabase, id).catch(() => null);
    const otherLinkedLawIds =
      sharedGroup?.lawIds.filter((lawId) => lawId !== id) ?? [];

    if (hasLawColumnUpdates) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase.from("laws") as any).update(updates).eq("id", id);
      if (updateErr) {
        console.error("Admin law PUT error:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      if (otherLinkedLawIds.length > 0) {
        const sharedUpdates = toSharedLawUpdates(updates);
        await propagateSharedLawFields(
          supabase,
          id,
          otherLinkedLawIds,
          sharedUpdates
        );
        propagatedLawIds = otherLinkedLawIds;
      }
    }

    if (hasCategorySync && categoryIdsPayload) {
      try {
        await syncLawCategories(supabase, id, categoryIdsPayload);
        if (otherLinkedLawIds.length > 0) {
          await propagateLawCategoriesAcrossSharedGroup(supabase, id, otherLinkedLawIds);
          propagatedLawIds = Array.from(new Set([...propagatedLawIds, ...otherLinkedLawIds]));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Category sync failed";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    const { data, error } = await supabase
      .from("laws")
      .select(
        "id, title, country_id, applies_to_all_countries, category_id, year, status, treaty_type, source_url, source_name"
      )
      .eq("id", id)
      .single();

    if (error) {
      console.error("Admin law PUT reload error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const lawRow = data as LawRow;
    let category_ids: string[] = lawRow.category_id ? [lawRow.category_id] : [];
    try {
      category_ids = await fetchCategoryIdsForLaw(supabase, id);
    } catch {
      category_ids = lawRow.category_id ? [lawRow.category_id] : [];
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "law.update",
      entityType: "law",
      entityId: id,
      details: {
        fields: [...nonTsKeys, ...(hasCategorySync ? ["category_ids"] : [])],
        title: lawRow?.title,
        shared_group_id: sharedGroup?.groupId ?? null,
        propagated_law_ids: propagatedLawIds,
      },
    });

    return NextResponse.json({
      ok: true,
      law: { ...lawRow, category_ids },
      shared_link_propagation: {
        group_id: sharedGroup?.groupId ?? null,
        propagated_law_ids: propagatedLawIds,
      },
    });
  } catch (err) {
    console.error("Admin law PUT error:", err);
    return NextResponse.json({ error: "Failed to update law" }, { status: 500 });
  }
}

/** DELETE: remove a law from the database (admin only). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing law id" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const { data: existing, error: fetchError } = await supabase
      .from("laws")
      .select(
        "id, country_id, applies_to_all_countries, category_id, title, source_url, source_name, year, status, content, content_plain, metadata, created_at, updated_at"
      )
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Law not found" }, { status: 404 });
    }

    const existingLaw = existing as LawRow;

    // Archive into deleted_laws before hard delete.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: archiveError } = await (supabase.from("deleted_laws") as any).insert({
      id: existingLaw.id,
      country_id: existingLaw.country_id,
      applies_to_all_countries: existingLaw.applies_to_all_countries,
      category_id: existingLaw.category_id,
      title: existingLaw.title,
      source_url: existingLaw.source_url,
      source_name: existingLaw.source_name,
      year: existingLaw.year,
      status: existingLaw.status,
      content: existingLaw.content,
      content_plain: existingLaw.content_plain,
      metadata: existingLaw.metadata,
      created_at: existingLaw.created_at,
      updated_at: existingLaw.updated_at,
      deleted_at: new Date().toISOString(),
      deleted_by: UUID_RE.test(admin.userId) ? admin.userId : null,
      delete_reason: "admin_delete_single",
    });

    if (archiveError) {
      console.error("Admin law DELETE archive error:", archiveError);
      return NextResponse.json(
        { error: "Failed to archive deleted law", details: archiveError.message },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase.from("laws") as any).delete().eq("id", id);

    if (deleteError) {
      console.error("Admin law DELETE error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "law.delete",
      entityType: "law",
      entityId: id,
      details: { title: existingLaw.title, archived: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin law DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete law" }, { status: 500 });
  }
}

