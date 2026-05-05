import type { SupabaseClient } from "@supabase/supabase-js";

/** Dedupe, validate non-empty UUID-like strings. */
export function normalizeCategoryIdList(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Replace junction rows for a law and set laws.category_id to the first id (primary).
 */
export async function syncLawCategories(
  supabase: SupabaseClient,
  lawId: string,
  categoryIds: string[]
): Promise<void> {
  const ids = normalizeCategoryIdList(categoryIds);
  if (ids.length === 0) {
    throw new Error("At least one category is required.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { error: delErr } = await db.from("law_categories").delete().eq("law_id", lawId);
  if (delErr) throw new Error(delErr.message);

  const rows = ids.map((category_id) => ({ law_id: lawId, category_id }));
  const { error: insErr } = await db.from("law_categories").insert(rows);
  if (insErr) throw new Error(insErr.message);

  const { error: upErr } = await db.from("laws").update({ category_id: ids[0] }).eq("id", lawId);
  if (upErr) throw new Error(upErr.message);
}

export async function fetchLawIdsForCategory(
  supabase: SupabaseClient,
  categoryId: string
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("law_categories")
    .select("law_id")
    .eq("category_id", categoryId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ law_id: string }>;
  return [...new Set(rows.map((r) => r.law_id))];
}

export async function fetchCategoryIdsForLaw(
  supabase: SupabaseClient,
  lawId: string
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lawRow, error: lawErr } = await (supabase as any)
    .from("laws")
    .select("category_id")
    .eq("id", lawId)
    .maybeSingle();
  if (lawErr) throw new Error(lawErr.message);
  const primary = lawRow?.category_id as string | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("law_categories")
    .select("category_id")
    .eq("law_id", lawId);
  if (error) throw new Error(error.message);
  const junctionRows = (data ?? []) as Array<{ category_id: string }>;
  const fromJunction = new Set(junctionRows.map((r) => r.category_id));

  if (fromJunction.size === 0 && primary) {
    return [primary];
  }
  const rest = [...fromJunction].filter((id: string) => id !== primary).sort();
  return primary ? [primary, ...rest] : [...fromJunction].sort();
}
