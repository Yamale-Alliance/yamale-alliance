import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { resolveInternalLibraryCategoryId } from "@/lib/internal-library-categories";
import {
  escapeIlikePattern,
  lawsCountryGlobalOrScopedIds,
  lawsCountryOrGlobalWithTitleContentTerms,
  lawsCountryOrGlobalWithTitleTerms,
  lawsOrGlobalForCountry,
  postgrestIlikePattern,
} from "@/lib/law-country-scope";
import { fetchValidLawIdsForCountryScope } from "@/lib/law-country-scope-ids";

export type CountryLibraryScope = {
  scopedLawIds: string[];
  countryScopeOr: string | null;
};

/**
 * Resolve validated `law_country_scopes` IDs and the PostgREST `.or()` filter for a country.
 * Excludes repealed laws, internal library category, and orphaned scope rows.
 */
export async function resolveCountryLibraryScope(
  supabase: SupabaseClient<Database>,
  countryId: string | null | undefined
): Promise<CountryLibraryScope> {
  if (!countryId?.trim()) {
    return { scopedLawIds: [], countryScopeOr: null };
  }
  const internalCategoryId = await resolveInternalLibraryCategoryId(supabase);
  const scopedLawIds = await fetchValidLawIdsForCountryScope(
    supabase,
    countryId,
    internalCategoryId
  );
  return {
    scopedLawIds,
    countryScopeOr: lawsCountryGlobalOrScopedIds(countryId, scopedLawIds),
  };
}

/**
 * Country scope AND title match — required when laws are linked via `law_country_scopes`
 * but `country_id` on the row points elsewhere.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyCountryScopedTitleSearch(
  query: any,
  countryId: string,
  countryScopeOr: string | null,
  titleTerms: string[]
): any {
  const terms = titleTerms
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2);
  if (countryScopeOr) {
    let q = query.or(countryScopeOr);
    if (terms.length > 0) {
      const titleOr = terms
        .slice(0, 8)
        .map((t) => `title.ilike.%${escapeIlikePattern(t)}%`)
        .join(",");
      q = q.or(titleOr);
    }
    return q;
  }
  if (terms.length === 0) {
    return query.or(lawsOrGlobalForCountry(countryId));
  }
  return query.or(lawsCountryOrGlobalWithTitleTerms(countryId, terms));
}

/**
 * Country scope AND title/content match for primary AI library text search.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyCountryScopedTextSearch(
  query: any,
  countryId: string,
  countryScopeOr: string | null,
  escapedTerms: string[]
): any {
  const terms = escapedTerms.map((t) => t.trim()).filter((t) => t.length >= 2);
  if (countryScopeOr) {
    let q = query.or(countryScopeOr);
    if (terms.length > 0) {
      const textOr = terms
        .slice(0, 6)
        .flatMap((esc) => {
          const pattern = `%${postgrestIlikePattern(esc)}%`;
          return [
            `title.ilike.${pattern}`,
            `content.ilike.${pattern}`,
            `content_plain.ilike.${pattern}`,
          ];
        })
        .join(",");
      q = q.or(textOr);
    }
    return q;
  }
  if (terms.length === 0) {
    return query.or(lawsOrGlobalForCountry(countryId));
  }
  return query.or(lawsCountryOrGlobalWithTitleContentTerms(countryId, terms));
}
