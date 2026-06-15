import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { assignLawSlug } from "@/lib/content-slug-assign";
import { fetchCategoryIdsForLaw, syncLawCategories } from "@/lib/law-categories-sync";
import { fetchSharedGroupForLaw } from "@/lib/law-shared-groups";

type LawRow = Database["public"]["Tables"]["laws"]["Row"];

export type ExpandLawCountriesResult = {
  created: Array<{ id: string; country_id: string }>;
  skipped: Array<{ country_id: string; reason: string; existing_law_id?: string }>;
};

/** Country IDs already covered by this law row and any linked shared-group peers. */
export async function fetchAssignedCountryIdsForLaw(
  supabase: SupabaseClient<Database>,
  lawId: string,
  law?: Pick<LawRow, "country_id" | "applies_to_all_countries">
): Promise<string[]> {
  let row = law;
  if (!row) {
    const { data, error } = await supabase
      .from("laws")
      .select("country_id, applies_to_all_countries")
      .eq("id", lawId)
      .single();
    if (error || !data) return [];
    row = data as Pick<LawRow, "country_id" | "applies_to_all_countries">;
  }

  if (row.applies_to_all_countries) return [];

  const ids = new Set<string>();
  if (row.country_id) ids.add(row.country_id);

  const group = await fetchSharedGroupForLaw(supabase, lawId).catch(() => null);
  if (group && group.lawIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: peers } = await (supabase as any)
      .from("laws")
      .select("country_id")
      .in("id", group.lawIds);
    for (const peer of (peers ?? []) as Array<{ country_id: string | null }>) {
      if (peer.country_id) ids.add(peer.country_id);
    }
  }

  return Array.from(ids);
}

export async function linkLawsToSharedGroup(
  supabase: SupabaseClient<Database>,
  sourceLawId: string,
  newLawIds: string[]
): Promise<void> {
  if (newLawIds.length === 0) return;

  const group = await fetchSharedGroupForLaw(supabase, sourceLawId).catch(() => null);
  if (group) {
    const existing = new Set(group.lawIds);
    const toAdd = newLawIds.filter((id) => !existing.has(id));
    if (toAdd.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("law_shared_group_members")
      .insert(toAdd.map((law_id) => ({ group_id: group.groupId, law_id })));
    if (error) throw new Error(error.message);
    return;
  }

  const allIds = Array.from(new Set([sourceLawId, ...newLawIds]));
  if (allIds.length < 2) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: groupRow, error: groupErr } = await (supabase as any)
    .from("law_shared_groups")
    .insert({ name: null })
    .select("id")
    .single();
  if (groupErr || !groupRow?.id) {
    throw new Error(groupErr?.message ?? "Failed to create shared law group");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: memberErr } = await (supabase as any)
    .from("law_shared_group_members")
    .insert(allIds.map((law_id) => ({ group_id: groupRow.id, law_id })));
  if (memberErr) throw new Error(memberErr.message);
}

async function cloneLawRowForCountry(
  supabase: SupabaseClient<Database>,
  sourceLawId: string,
  countryId: string,
  sourceRow: LawRow
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcId, error: rpcErr } = await (supabase as any).rpc("clone_law_to_country", {
    p_source_law_id: sourceLawId,
    p_target_country_id: countryId,
  });

  if (!rpcErr && typeof rpcId === "string" && rpcId.length > 0) {
    return rpcId;
  }

  const insertRow = {
    country_id: countryId,
    applies_to_all_countries: false,
    category_id: sourceRow.category_id,
    title: sourceRow.title,
    source_url: sourceRow.source_url,
    source_name: sourceRow.source_name,
    year: sourceRow.year,
    status: sourceRow.status,
    treaty_type: sourceRow.treaty_type,
    content: sourceRow.content,
    content_plain: sourceRow.content_plain,
    language_code: sourceRow.language_code,
    content_hash: (sourceRow as { content_hash?: string | null }).content_hash ?? null,
    ingested_by: (sourceRow as { ingested_by?: string | null }).ingested_by ?? null,
    ingested_at: (sourceRow as { ingested_at?: string | null }).ingested_at ?? null,
    rag_approval_status:
      (sourceRow as { rag_approval_status?: string | null }).rag_approval_status ?? null,
    metadata: sourceRow.metadata,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertErr } = await (supabase.from("laws") as any)
    .insert(insertRow)
    .select("id")
    .single();

  if (insertErr || !inserted?.id) {
    const hint =
      rpcErr?.message && /clone_law_to_country|function/i.test(rpcErr.message)
        ? " (Run docs/sql/clone-law-to-country.sql in Supabase for faster large-law copies.)"
        : "";
    throw new Error((insertErr?.message ?? rpcErr?.message ?? "Failed to create law for country") + hint);
  }

  return inserted.id as string;
}

/**
 * Insert one law row per requested country that is not already assigned.
 * Copies metadata and body from the source law; links new rows via shared group.
 */
export async function expandLawToAdditionalCountries(
  supabase: SupabaseClient<Database>,
  sourceLawId: string,
  requestedCountryIds: string[],
  categoryIds: string[]
): Promise<ExpandLawCountriesResult> {
  const uniqueRequested = Array.from(
    new Set(requestedCountryIds.map((id) => id.trim()).filter(Boolean))
  );
  if (uniqueRequested.length === 0) {
    return { created: [], skipped: [] };
  }

  const assigned = new Set(await fetchAssignedCountryIdsForLaw(supabase, sourceLawId));
  const toCreate = uniqueRequested.filter((id) => !assigned.has(id));
  if (toCreate.length === 0) {
    return { created: [], skipped: [] };
  }

  const { data: source, error: sourceErr } = await supabase
    .from("laws")
    .select(
      "id, title, category_id, year, status, treaty_type, source_url, source_name, language_code, content_hash, ingested_by, ingested_at, rag_approval_status, metadata"
    )
    .eq("id", sourceLawId)
    .single();

  if (sourceErr || !source) {
    throw new Error(sourceErr?.message ?? "Source law not found");
  }

  const sourceRow = source as LawRow;
  let sourceRowForFallback: LawRow | null = null;
  const effectiveCategoryIds =
    categoryIds.length > 0 ? categoryIds : await fetchCategoryIdsForLaw(supabase, sourceLawId);
  const primaryCategoryId = effectiveCategoryIds[0] ?? sourceRow.category_id;
  if (!primaryCategoryId) {
    throw new Error("At least one category is required to expand to more countries");
  }

  const created: ExpandLawCountriesResult["created"] = [];
  const skipped: ExpandLawCountriesResult["skipped"] = [];

  for (const countryId of toCreate) {
    const { data: existing } = await supabase
      .from("laws")
      .select("id")
      .eq("country_id", countryId)
      .eq("category_id", primaryCategoryId)
      .eq("title", sourceRow.title)
      .limit(1)
      .maybeSingle();

    const existingRow = existing as { id: string } | null;
    if (existingRow?.id) {
      skipped.push({
        country_id: countryId,
        reason: "already_exists",
        existing_law_id: existingRow.id,
      });
      continue;
    }

    let newId: string;
    try {
      newId = await cloneLawRowForCountry(supabase, sourceLawId, countryId, {
        ...sourceRow,
        category_id: primaryCategoryId,
      } as LawRow);
    } catch (cloneErr) {
      if (!sourceRowForFallback) {
        const { data: fullSource, error: fullErr } = await supabase
          .from("laws")
          .select(
            "id, title, category_id, year, status, treaty_type, source_url, source_name, content, content_plain, language_code, content_hash, ingested_by, ingested_at, rag_approval_status, metadata"
          )
          .eq("id", sourceLawId)
          .single();
        if (fullErr || !fullSource) {
          throw new Error(fullErr?.message ?? "Could not load source law text for copy");
        }
        sourceRowForFallback = fullSource as LawRow;
      }
      newId = await cloneLawRowForCountry(supabase, sourceLawId, countryId, {
        ...sourceRowForFallback,
        category_id: primaryCategoryId,
      });
    }

    await syncLawCategories(supabase, newId, effectiveCategoryIds);

    try {
      const { data: slugRow } = await supabase
        .from("laws")
        .select("id, title, year, countries(name)")
        .eq("id", newId)
        .single();
      const slugLaw = slugRow as {
        title?: string;
        year?: number | null;
        countries?: { name: string } | null;
      } | null;
      if (slugLaw?.title) {
        await assignLawSlug(supabase, {
          id: newId,
          title: slugLaw.title,
          year: slugLaw.year,
          countries: slugLaw.countries ?? null,
        });
      }
    } catch {
      /* slug column may not be migrated yet */
    }

    created.push({ id: newId, country_id: countryId });
  }

  if (created.length > 0) {
    await linkLawsToSharedGroup(
      supabase,
      sourceLawId,
      created.map((c) => c.id)
    );

    const skippedExistingIds = skipped
      .map((s) => s.existing_law_id)
      .filter((lawId): lawId is string => Boolean(lawId));
    if (skippedExistingIds.length > 0) {
      await linkLawsToSharedGroup(supabase, sourceLawId, skippedExistingIds);
    }
  }

  return { created, skipped };
}
