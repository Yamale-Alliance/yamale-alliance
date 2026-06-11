import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const SCOPE_ID_VALIDATE_CHUNK = 80;

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

/**
 * Fetch law IDs that explicitly apply to a country via `law_country_scopes`.
 * Returns [] if table/rows are unavailable so callers can safely fall back.
 */
export async function fetchLawIdsForCountryScope(
  supabase: SupabaseClient<Database>,
  countryId: string
): Promise<string[]> {
  try {
    const { data, error } = await (supabase.from("law_country_scopes") as any)
      .select("law_id")
      .eq("country_id", countryId)
      .limit(5000);
    if (error || !Array.isArray(data)) return [];
    return Array.from(
      new Set(
        data
          .map((r: { law_id?: string }) => String(r?.law_id ?? "").trim())
          .filter((id: string) => id.length > 0)
      )
    );
  } catch {
    return [];
  }
}

/**
 * Scope IDs that still point at a public, non-repealed law row.
 * Drops orphaned `law_country_scopes` rows and internal-category instruments.
 */
export async function fetchValidLawIdsForCountryScope(
  supabase: SupabaseClient<Database>,
  countryId: string,
  internalCategoryId?: string | null
): Promise<string[]> {
  const rawIds = await fetchLawIdsForCountryScope(supabase, countryId);
  if (rawIds.length === 0) return [];

  const valid = new Set<string>();
  for (const chunk of chunkIds(rawIds, SCOPE_ID_VALIDATE_CHUNK)) {
    let q = supabase.from("laws").select("id").in("id", chunk).neq("status", "Repealed");
    if (internalCategoryId) {
      q = q.neq("category_id", internalCategoryId);
    }
    const { data, error } = await q;
    if (error) continue;
    for (const row of data ?? []) {
      valid.add(String((row as { id: string }).id));
    }
  }
  return Array.from(valid);
}
