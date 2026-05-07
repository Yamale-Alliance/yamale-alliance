import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

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
