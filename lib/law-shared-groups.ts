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
