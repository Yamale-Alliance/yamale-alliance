import { lawsCountryOrGlobalWithTitleTerms } from "@/lib/law-country-scope";
import { LAW_HAS_BODY_OR_FILTER } from "@/lib/law-readable-body";
import { INTENT_TITLE_LAWS_SELECT } from "@/lib/ai-intent-title-retrieval";

const LAWS_LIST_SELECT = INTENT_TITLE_LAWS_SELECT;

const LAWS_BODY_SELECT =
  "id, title, content, content_plain, year, status, metadata, source_name, country_id, applies_to_all_countries, category_id, countries(name), categories!laws_category_id_fkey(name)";

/**
 * Fast country-scoped fallback: title-only filter (indexed), then hydrate bodies for matched ids.
 * Avoids scanning full content_plain for every law in the country (~20s on Togo).
 */
export async function fastCountryScopedLawFallback(
  supabase: any,
  opts: {
    countryId: string;
    countryScopeOr: string | null;
    titleWords: string[];
    limit?: number;
  }
): Promise<any[]> {
  const limit = opts.limit ?? 50;
  const words = opts.titleWords
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 3 && w.length <= 22);

  let q = supabase
    .from("laws")
    .select(LAWS_LIST_SELECT)
    .or(LAW_HAS_BODY_OR_FILTER)
    .neq("status", "Repealed");

  if (words.length > 0) {
    q = q.or(lawsCountryOrGlobalWithTitleTerms(opts.countryId, words));
  } else if (opts.countryScopeOr) {
    q = q.or(opts.countryScopeOr);
  } else {
    q = q.eq("country_id", opts.countryId);
  }

  const { data, error } = await q.limit(limit);
  if (error || !data?.length) {
    return [];
  }

  const ids = (data as Array<{ id: string }>).map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return data as any[];

  const { data: hydrated, error: hydrateErr } = await supabase
    .from("laws")
    .select(LAWS_BODY_SELECT)
    .in("id", ids);

  if (hydrateErr || !hydrated?.length) {
    return data as any[];
  }
  return hydrated as any[];
}
