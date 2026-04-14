/**
 * PostgREST `.or()` filter: laws for a specific country OR marked as applying everywhere.
 */
export function lawsOrGlobalForCountry(countryId: string): string {
  return `country_id.eq.${countryId},applies_to_all_countries.eq.true`;
}

/** Escape `%` / `_` for PostgREST `ilike` patterns. */
export function escapeIlikePattern(s: string): string {
  return s.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * (Country-scoped match OR global) AND (title/content ilike).
 * Use as a single `.or(...)` so it does not overwrite other `.or()` filters.
 */
export function lawsCountryOrGlobalWithTextSearch(countryId: string, escapedLowerTerms: string): string {
  const textMatch = `or(title.ilike.%${escapedLowerTerms}%,content.ilike.%${escapedLowerTerms}%)`;
  return `and(country_id.eq.${countryId},${textMatch}),and(applies_to_all_countries.eq.true,${textMatch})`;
}
