import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchCategoryIdsForLaw, syncLawCategories } from "@/lib/law-categories-sync";

type LawUpdatePayload = Partial<Database["public"]["Tables"]["laws"]["Update"]>;

const SHAREABLE_LAW_COLUMNS = [
  "title",
  "category_id",
  "year",
  "status",
  "treaty_type",
  "source_url",
  "source_name",
  "content",
  "content_plain",
] as const;

export function toSharedLawUpdates(
  updates: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (key === "updated_at" || SHAREABLE_LAW_COLUMNS.includes(key as (typeof SHAREABLE_LAW_COLUMNS)[number])) {
      out[key] = value;
    }
  }
  if (!("updated_at" in out)) {
    out.updated_at = new Date().toISOString();
  }
  return out;
}

export async function fetchSharedGroupForLaw(
  supabase: SupabaseClient<Database>,
  lawId: string
): Promise<{ groupId: string; lawIds: string[] } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership, error: membershipErr } = await (supabase as any)
    .from("law_shared_group_members")
    .select("group_id")
    .eq("law_id", lawId)
    .maybeSingle();

  if (membershipErr) throw membershipErr;
  const groupId = membership?.group_id as string | undefined;
  if (!groupId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members, error: membersErr } = await (supabase as any)
    .from("law_shared_group_members")
    .select("law_id")
    .eq("group_id", groupId);

  if (membersErr) throw membersErr;
  const lawIds = ((members ?? []) as Array<{ law_id: string }>)
    .map((m) => m.law_id)
    .filter(Boolean);

  return { groupId, lawIds };
}

export async function propagateLawCategoriesAcrossSharedGroup(
  supabase: SupabaseClient<Database>,
  sourceLawId: string,
  targetLawIds: string[]
): Promise<void> {
  const sourceCategoryIds = await fetchCategoryIdsForLaw(supabase, sourceLawId);
  for (const targetId of targetLawIds) {
    await syncLawCategories(supabase, targetId, sourceCategoryIds);
  }
}

export async function propagateSharedLawFields(
  supabase: SupabaseClient<Database>,
  sourceLawId: string,
  targetLawIds: string[],
  updates: LawUpdatePayload
): Promise<void> {
  if (targetLawIds.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("laws") as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .in("id", targetLawIds);

  if (error) throw error;
}

export type SharedGroupLawSummary = {
  id: string;
  title: string;
  country_id: string | null;
  applies_to_all_countries: boolean;
  country_name: string;
  status: string;
  updated_at: string;
};

export type SharedGroupListItem = {
  id: string;
  name: string | null;
  created_at: string;
  updated_at: string;
  laws: SharedGroupLawSummary[];
};

export async function fetchLawIdsInSharedGroup(
  supabase: SupabaseClient<Database>,
  groupId: string
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("law_shared_group_members")
    .select("law_id")
    .eq("group_id", groupId);
  if (error) throw error;
  return ((data ?? []) as Array<{ law_id: string }>).map((r) => r.law_id).filter(Boolean);
}

const IN_QUERY_CHUNK_SIZE = 150;
const MEMBERS_PAGE_SIZE = 1000;

function chunkIds<T>(ids: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

type SharedGroupRow = {
  id: string;
  name: string | null;
  created_at: string;
  updated_at: string;
};

async function fetchAllSharedGroupRows(supabase: SupabaseClient<Database>): Promise<SharedGroupRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result = await (supabase as any)
    .from("law_shared_groups")
    .select("id, name, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (result.error) {
    const missingUpdated =
      result.error.message?.toLowerCase().includes("updated_at") ||
      result.error.code === "PGRST204";
    if (!missingUpdated) throw result.error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await (supabase as any)
      .from("law_shared_groups")
      .select("id, name, created_at")
      .order("created_at", { ascending: false });
    if (result.error) throw result.error;
    return ((result.data ?? []) as Array<{ id: string; name: string | null; created_at: string }>).map(
      (g) => ({
        ...g,
        updated_at: g.created_at,
      })
    );
  }

  return (result.data ?? []) as SharedGroupRow[];
}

/** Paginate members — avoids PostgREST limits on huge `.in(group_id, …)` filters. */
async function fetchAllSharedGroupMembers(
  supabase: SupabaseClient<Database>
): Promise<Array<{ group_id: string; law_id: string }>> {
  const rows: Array<{ group_id: string; law_id: string }> = [];
  let offset = 0;
  for (;;) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("law_shared_group_members")
      .select("group_id, law_id")
      .order("group_id", { ascending: true })
      .range(offset, offset + MEMBERS_PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as Array<{ group_id: string; law_id: string }>;
    rows.push(...batch);
    if (batch.length < MEMBERS_PAGE_SIZE) break;
    offset += MEMBERS_PAGE_SIZE;
  }
  return rows;
}

type LawRowForSummary = {
  id: string;
  title: string;
  country_id: string | null;
  applies_to_all_countries: boolean;
  status: string;
  updated_at: string;
  countries: { name: string } | null;
};

async function fetchLawSummariesByIds(
  supabase: SupabaseClient<Database>,
  lawIds: string[]
): Promise<Map<string, SharedGroupLawSummary>> {
  const lawById = new Map<string, SharedGroupLawSummary>();
  if (lawIds.length === 0) return lawById;

  const selectWithCountry =
    "id, title, country_id, applies_to_all_countries, status, updated_at, countries(name)";
  const selectPlain = "id, title, country_id, applies_to_all_countries, status, updated_at";

  let useCountryEmbed = true;
  const countryNameById = new Map<string, string>();

  for (const chunk of chunkIds(lawIds, IN_QUERY_CHUNK_SIZE)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data, error } = await (supabase as any)
      .from("laws")
      .select(useCountryEmbed ? selectWithCountry : selectPlain)
      .in("id", chunk);

    if (error && useCountryEmbed) {
      useCountryEmbed = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ data, error } = await (supabase as any).from("laws").select(selectPlain).in("id", chunk));
    }
    if (error) throw error;

    for (const row of (data ?? []) as LawRowForSummary[]) {
      lawById.set(row.id, {
        id: row.id,
        title: row.title,
        country_id: row.country_id,
        applies_to_all_countries: Boolean(row.applies_to_all_countries),
        country_name: row.applies_to_all_countries
          ? "All countries"
          : row.countries?.name?.trim() || "—",
        status: row.status,
        updated_at: row.updated_at,
      });
    }
  }

  if (!useCountryEmbed) {
    const countryIds = Array.from(
      new Set(
        Array.from(lawById.values())
          .map((l) => l.country_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    for (const chunk of chunkIds(countryIds, IN_QUERY_CHUNK_SIZE)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("countries").select("id, name").in("id", chunk);
      if (error) throw error;
      for (const c of (data ?? []) as Array<{ id: string; name: string }>) {
        if (c.id && c.name) countryNameById.set(c.id, c.name);
      }
    }
    for (const law of lawById.values()) {
      if (!law.applies_to_all_countries && law.country_id) {
        law.country_name = countryNameById.get(law.country_id)?.trim() || "—";
      }
    }
  }

  return lawById;
}

/** All shared-law groups with member law metadata (admin linked-laws page). */
export async function fetchAllSharedGroupsWithLaws(
  supabase: SupabaseClient<Database>
): Promise<SharedGroupListItem[]> {
  const groupRows = await fetchAllSharedGroupRows(supabase);
  if (groupRows.length === 0) return [];

  const groupIdSet = new Set(groupRows.map((g) => g.id));
  const memberRows = (await fetchAllSharedGroupMembers(supabase)).filter((m) =>
    groupIdSet.has(m.group_id)
  );

  const lawIds = Array.from(new Set(memberRows.map((m) => m.law_id).filter(Boolean)));
  const lawById = await fetchLawSummariesByIds(supabase, lawIds);

  const lawsByGroup = new Map<string, SharedGroupLawSummary[]>();
  for (const m of memberRows) {
    const law = lawById.get(m.law_id);
    if (!law) continue;
    const list = lawsByGroup.get(m.group_id) ?? [];
    list.push(law);
    lawsByGroup.set(m.group_id, list);
  }

  return groupRows.map((g) => {
    const lawsInGroup = (lawsByGroup.get(g.id) ?? []).sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
    );
    return { ...g, laws: lawsInGroup };
  });
}

/**
 * Remove link rows only — law rows (title, text, categories, country) are unchanged.
 */
export async function dissolveSharedGroup(
  supabase: SupabaseClient<Database>,
  groupId: string
): Promise<{ lawIds: string[] }> {
  const lawIds = await fetchLawIdsInSharedGroup(supabase, groupId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: memberErr } = await (supabase as any)
    .from("law_shared_group_members")
    .delete()
    .eq("group_id", groupId);
  if (memberErr) throw memberErr;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: groupErr } = await (supabase as any).from("law_shared_groups").delete().eq("id", groupId);
  if (groupErr) throw groupErr;
  return { lawIds };
}

/** Remove one law from a group; dissolves the group if fewer than two members remain. */
export async function removeLawFromSharedGroup(
  supabase: SupabaseClient<Database>,
  groupId: string,
  lawId: string
): Promise<{ dissolved: boolean; remainingLawIds: string[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (supabase as any)
    .from("law_shared_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("law_id", lawId);
  if (delErr) throw delErr;

  const remainingLawIds = await fetchLawIdsInSharedGroup(supabase, groupId);
  if (remainingLawIds.length <= 1) {
    await dissolveSharedGroup(supabase, groupId);
    return { dissolved: true, remainingLawIds: [] };
  }
  return { dissolved: false, remainingLawIds };
}
