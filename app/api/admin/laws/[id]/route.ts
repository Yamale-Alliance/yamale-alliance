import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin, requireLawsAccess, assertCanEditLaw, assertCanDeleteLaw } from "@/lib/admin";
import { canEditLaw } from "@/lib/admin-roles";
import { recordAuditLog } from "@/lib/admin-audit";
import { isLawTreatyType } from "@/lib/law-treaty-type";
import { DEFAULT_LAW_LEVEL, isLawLevel } from "@/lib/law-level";
import type { Database } from "@/lib/database.types";
import { fetchCategoryIdsForLaw, syncLawCategories } from "@/lib/law-categories-sync";
import { assignLawSlug } from "@/lib/content-slug-assign";
import { touchLawLastVerifiedAt } from "@/lib/law-last-verified";
import {
  fetchSharedGroupForLaw,
  propagateLawCategoriesAcrossSharedGroup,
  propagateSharedLawFields,
  toSharedLawUpdates,
} from "@/lib/law-shared-groups";
import { normalizeLawDocumentLanguageCode } from "@/lib/law-document-language";
import {
  expandLawToAdditionalCountries,
  fetchAssignedCountryIdsForLaw,
} from "@/lib/admin-law-expand-countries";
import {
  computeLawContentHash,
  LAW_RAG_PENDING_STATUS,
} from "@/lib/laws-rag-integrity";

/** Large laws: country expansion + optional body sync can take several minutes. */
export const maxDuration = 300;

const SHAREABLE_UPDATE_KEYS = new Set([
  "title",
  "category_id",
  "year",
  "status",
  "treaty_type",
  "level",
  "source_url",
  "source_name",
  "content",
  "content_plain",
  "content_hash",
  "ingested_by",
  "ingested_at",
  "rag_approval_status",
]);

type LawRow = Database["public"]["Tables"]["laws"]["Row"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** GET: fetch a single law for admin editing (including full text). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireLawsAccess();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing law id" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const fullSelect =
      "id, slug, title, country_id, applies_to_all_countries, category_id, year, status, treaty_type, level, source_url, source_name, content, content_plain, language_code, last_verified_at, rag_approval_status, ingested_by, ingested_at, content_hash";
    const legacySelect =
      "id, slug, title, country_id, applies_to_all_countries, category_id, year, status, source_url, source_name, content, content_plain, language_code, last_verified_at";

    const { data, error } = await supabase
      .from("laws")
      .select(fullSelect)
      .eq("id", id)
      .single();

    if (error) {
      const missingLevelColumn =
        error.message?.toLowerCase().includes("level") ||
        (error.code === "PGRST204" && error.message?.toLowerCase().includes("level"));
      const missingTreatyColumn =
        error.message?.toLowerCase().includes("treaty_type") ||
        error.code === "PGRST204";
      const missingRagColumn =
        error.message?.toLowerCase().includes("rag_approval_status") ||
        error.message?.toLowerCase().includes("ingested_at") ||
        error.message?.toLowerCase().includes("content_hash");
      if (missingLevelColumn && !missingTreatyColumn) {
        const withoutLevelSelect =
          "id, slug, title, country_id, applies_to_all_countries, category_id, year, status, treaty_type, source_url, source_name, content, content_plain, language_code, last_verified_at, rag_approval_status, ingested_by, ingested_at, content_hash";
        const levelLegacyRes = await supabase.from("laws").select(withoutLevelSelect).eq("id", id).single();
        const levelLegacyData = levelLegacyRes.data as LawRow | null;
        if (levelLegacyRes.error || !levelLegacyData) {
          return NextResponse.json({ error: "Law not found" }, { status: 404 });
        }
        const law = {
          ...levelLegacyData,
          level: DEFAULT_LAW_LEVEL,
        };
        let category_ids: string[] = law.category_id ? [law.category_id] : [];
        try {
          category_ids = await fetchCategoryIdsForLaw(supabase, id);
        } catch {
          /* law_categories table may not exist yet */
        }
        const country_ids = law.applies_to_all_countries
          ? []
          : await fetchAssignedCountryIdsForLaw(supabase, id, law);
        return NextResponse.json({
          law: { ...law, category_ids, country_ids },
          warning: "Missing level column; run migration 20260714090000_add_laws_level.",
        });
      }
      if (missingRagColumn && !missingTreatyColumn) {
        const ragLegacySelect =
          "id, slug, title, country_id, applies_to_all_countries, category_id, year, status, treaty_type, level, source_url, source_name, content, content_plain, language_code, last_verified_at";
        const ragLegacyRes = await supabase.from("laws").select(ragLegacySelect).eq("id", id).single();
        const ragLegacyData = ragLegacyRes.data as LawRow | null;
        const ragLegacyError = ragLegacyRes.error;
        if (ragLegacyError || !ragLegacyData) {
          return NextResponse.json({ error: "Law not found" }, { status: 404 });
        }
        const law = ragLegacyData;
        let category_ids: string[] = law.category_id ? [law.category_id] : [];
        try {
          category_ids = await fetchCategoryIdsForLaw(supabase, id);
        } catch {
          /* law_categories table may not exist yet */
        }
        const country_ids = law.applies_to_all_countries
          ? []
          : await fetchAssignedCountryIdsForLaw(supabase, id, law);
        return NextResponse.json({
          law: { ...law, category_ids, country_ids, rag_approval_status: null },
          warning: "Missing RAG approval columns; run scripts/supabase/add-content-hash.sql",
        });
      }
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
          level: DEFAULT_LAW_LEVEL,
        };
        let category_ids: string[] = law.category_id ? [law.category_id] : [];
        try {
          category_ids = await fetchCategoryIdsForLaw(supabase, id);
        } catch {
          /* law_categories table may not exist yet */
        }
        const sharedGroupLegacy = await fetchSharedGroupForLaw(supabase, id).catch(() => null);
        const shared_link_peer_count_legacy = sharedGroupLegacy
          ? Math.max(0, sharedGroupLegacy.lawIds.length - 1)
          : 0;
        const country_ids_legacy = law.applies_to_all_countries
          ? []
          : await fetchAssignedCountryIdsForLaw(supabase, id, law);
        return NextResponse.json({
          law: { ...law, category_ids, country_ids: country_ids_legacy },
          warning: "Missing treaty_type column; run migration 064.",
          shared_link_peer_count: shared_link_peer_count_legacy,
          shared_group_id: sharedGroupLegacy?.groupId ?? null,
        });
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

    const sharedGroup = await fetchSharedGroupForLaw(supabase, id).catch(() => null);
    const shared_link_peer_count = sharedGroup ? Math.max(0, sharedGroup.lawIds.length - 1) : 0;
    const country_ids = law.applies_to_all_countries
      ? []
      : await fetchAssignedCountryIdsForLaw(supabase, id, law);

    return NextResponse.json({
      law: { ...law, category_ids, country_ids },
      shared_link_peer_count,
      shared_group_id: sharedGroup?.groupId ?? null,
      can_edit: canEditLaw(admin.role, admin.userId, (law as LawRow & { ingested_by?: string | null }).ingested_by),
    });
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
  const admin = await requireLawsAccess();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing law id" }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseServer();

    const { data: existingRow } = await supabase
      .from("laws")
      .select(
        "title, year, status, treaty_type, source_url, source_name, content, content_plain, language_code, ingested_by"
      )
      .eq("id", id)
      .maybeSingle();
    const existingLaw = existingRow as (LawRow & { ingested_by?: string | null }) | null;

    const editDenied = assertCanEditLaw(admin, existingLaw?.ingested_by);
    if (editDenied) return editDenied;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (!t) {
        return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
      }
      if (t !== (existingLaw?.title ?? "").trim()) {
        updates.title = t;
      }
    }
    if (body.applies_to_all_countries === true) {
      updates.applies_to_all_countries = true;
      updates.country_id = null;
    } else if (body.applies_to_all_countries === false) {
      const cid =
        typeof body.country_id === "string" && body.country_id.trim()
          ? body.country_id.trim()
          : "";
      const countryIdsFromBody = Array.isArray(body.country_ids)
        ? (body.country_ids as unknown[])
            .filter((v): v is string => typeof v === "string")
            .map((v) => v.trim())
            .filter(Boolean)
        : [];
      if (!cid && countryIdsFromBody.length === 0) {
        return NextResponse.json(
          { error: "Select a country, or enable “All countries” for treaties and regional instruments." },
          { status: 400 }
        );
      }
      updates.applies_to_all_countries = false;
      if (cid) {
        updates.country_id = cid;
      }
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
    const countryIdsPayload = Array.isArray(body.country_ids)
      ? Array.from(
          new Set(
            (body.country_ids as unknown[])
              .filter((v): v is string => typeof v === "string")
              .map((v) => v.trim())
              .filter(Boolean)
          )
        )
      : null;

    if (body.category_id !== undefined && !(categoryIdsPayload && categoryIdsPayload.length > 0)) {
      updates.category_id = body.category_id || null;
    }
    if (body.year !== undefined) {
      const nextYear = body.year ? Number(body.year) : null;
      const prevYear = existingLaw?.year ?? null;
      if (nextYear !== prevYear) updates.year = nextYear;
    }
    if (typeof body.status === "string") {
      const nextStatus = body.status.trim() || "In force";
      if (nextStatus !== (existingLaw?.status ?? "In force")) updates.status = nextStatus;
    }
    if (body.treaty_type !== undefined) {
      const treatyType = body.treaty_type ? String(body.treaty_type).trim() : "";
      if (!isLawTreatyType(treatyType)) {
        return NextResponse.json({ error: "Invalid treaty type" }, { status: 400 });
      }
      if (treatyType !== String(existingLaw?.treaty_type ?? "Not a treaty")) {
        updates.treaty_type = treatyType;
      }
    }
    if (body.level !== undefined) {
      const level = body.level ? String(body.level).trim() : "";
      if (!isLawLevel(level)) {
        return NextResponse.json(
          { error: "Invalid level. Use National, Regional, or International." },
          { status: 400 }
        );
      }
      if (level !== String((existingLaw as { level?: string } | null)?.level ?? DEFAULT_LAW_LEVEL)) {
        updates.level = level;
      }
    }
    if (typeof body.source_url === "string") {
      const next = body.source_url.trim() || null;
      const prev = existingLaw?.source_url?.trim() || null;
      if (next !== prev) updates.source_url = next;
    }
    if (typeof body.source_name === "string") {
      const next = body.source_name.trim() || null;
      const prev = existingLaw?.source_name?.trim() || null;
      if (next !== prev) updates.source_name = next;
    }
    if (body.language_code !== undefined) {
      const nextLang = normalizeLawDocumentLanguageCode(
        typeof body.language_code === "string" ? body.language_code : null
      );
      const prevLang = normalizeLawDocumentLanguageCode(existingLaw?.language_code ?? null);
      if (nextLang !== prevLang) {
        updates.language_code = nextLang;
      }
    }

    if (typeof body.content === "string") {
      const trimmed = body.content.trim() || null;
      const existingTrim =
        (existingLaw?.content_plain ?? existingLaw?.content ?? "").trim() || null;
      if (trimmed !== existingTrim) {
        updates.content = trimmed;
        updates.content_plain = trimmed;
        updates.content_hash = trimmed ? computeLawContentHash(trimmed) : null;
        updates.ingested_by = admin.userId;
        updates.ingested_at = new Date().toISOString();
        updates.rag_approval_status = LAW_RAG_PENDING_STATUS;
      }
    }

    const hasShareableFieldUpdates = Object.keys(updates).some((k) => SHAREABLE_UPDATE_KEYS.has(k));
    const nonTsKeys = Object.keys(updates).filter((k) => k !== "updated_at" && k !== "last_verified_at");
    const hasLawColumnUpdates = nonTsKeys.length > 0;
    const hasCategorySync = Boolean(categoryIdsPayload && categoryIdsPayload.length > 0);
    const hasCountryExpansionRequest =
      Boolean(countryIdsPayload && countryIdsPayload.length > 0) &&
      body.applies_to_all_countries !== true;

    if (!hasLawColumnUpdates && !hasCategorySync && !hasCountryExpansionRequest) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    if (hasLawColumnUpdates || hasCategorySync) {
      updates.last_verified_at = touchLawLastVerifiedAt();
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

      if (otherLinkedLawIds.length > 0 && hasShareableFieldUpdates) {
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

    let country_expansion: Awaited<ReturnType<typeof expandLawToAdditionalCountries>> | null = null;
    if (
      countryIdsPayload &&
      countryIdsPayload.length > 0 &&
      body.applies_to_all_countries !== true &&
      !updates.applies_to_all_countries
    ) {
      try {
        country_expansion = await expandLawToAdditionalCountries(
          supabase,
          id,
          countryIdsPayload,
          categoryIdsPayload ?? []
        );
        if (country_expansion.created.length > 0 && hasShareableFieldUpdates) {
          const sharedUpdates = toSharedLawUpdates(updates);
          const newIds = country_expansion.created.map((c) => c.id);
          await propagateSharedLawFields(supabase, id, newIds, sharedUpdates);
          if (hasCategorySync && categoryIdsPayload) {
            await propagateLawCategoriesAcrossSharedGroup(supabase, id, newIds);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to add law to additional countries";
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
    const country_ids = lawRow.applies_to_all_countries
      ? []
      : await fetchAssignedCountryIdsForLaw(supabase, id, lawRow);

    const slugFieldsChanged =
      updates.title !== undefined ||
      updates.year !== undefined ||
      updates.country_id !== undefined ||
      updates.applies_to_all_countries !== undefined;
    if (slugFieldsChanged && lawRow?.title) {
      try {
        const { data: slugRow } = await supabase
          .from("laws")
          .select("id, title, year, countries(name)")
          .eq("id", id)
          .single();
        const row = slugRow as {
          title?: string;
          year?: number | null;
          countries?: { name: string } | null;
        } | null;
        if (row?.title) {
          await assignLawSlug(supabase, {
            id,
            title: row.title,
            year: row.year,
            countries: row.countries ?? null,
          });
        }
      } catch {
        /* slug column may not be migrated yet */
      }
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
      law: { ...lawRow, category_ids, country_ids },
      shared_link_propagation: {
        group_id: sharedGroup?.groupId ?? null,
        propagated_law_ids: propagatedLawIds,
      },
      country_expansion: country_expansion
        ? {
            created_count: country_expansion.created.length,
            created_law_ids: country_expansion.created.map((c) => c.id),
            skipped: country_expansion.skipped,
          }
        : null,
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

  const deleteDenied = assertCanDeleteLaw(admin);
  if (deleteDenied) return deleteDenied;

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

