/**
 * PostgREST `.or()` filter: laws for a specific country OR marked as applying everywhere.
 */
export function lawsOrGlobalForCountry(countryId: string): string {
  return `country_id.eq.${countryId},applies_to_all_countries.eq.true`;
}

export function lawsCountryGlobalOrScopedIds(countryId: string, lawIds: string[]): string {
  const cleaned = lawIds.map((id) => id.trim()).filter(Boolean);
  if (cleaned.length === 0) return lawsOrGlobalForCountry(countryId);
  return `${lawsOrGlobalForCountry(countryId)},id.in.(${cleaned.join(",")})`;
}

/** Escape `%` / `_` for PostgREST `ilike` patterns. */
export function escapeIlikePattern(s: string): string {
  return s.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * (Country-scoped match OR global) AND (title/content ilike).
 * Use as a single `.or(...)` so it does not overwrite other `.or()` filters.
 */
/** Title, HTML body, and plain text (preferred for matching OCR/plain bodies). */
export function lawTextIlikeOr(escapedLowerTerms: string): string {
  return `title.ilike.%${escapedLowerTerms}%,content.ilike.%${escapedLowerTerms}%,content_plain.ilike.%${escapedLowerTerms}%`;
}

export function lawsCountryOrGlobalWithTextSearch(countryId: string, escapedLowerTerms: string): string {
  const textMatch = `or(${lawTextIlikeOr(escapedLowerTerms)})`;
  return `and(country_id.eq.${countryId},${textMatch}),and(applies_to_all_countries.eq.true,${textMatch})`;
}

/**
 * OR of several country+global scoped text searches — used when the user asks a factual
 * question (e.g. minimum wage) so we match any salient token, not only the full sentence.
 */
export function lawsCountryOrGlobalWithAnyEscapedTerms(countryId: string, escapedTerms: string[]): string {
  const terms = escapedTerms.map((t) => t.trim()).filter(Boolean);
  if (terms.length === 0) return lawsOrGlobalForCountry(countryId);
  const branches = terms.map((esc) => {
    const textMatch = `or(${lawTextIlikeOr(esc)})`;
    return `and(country_id.eq.${countryId},${textMatch}),and(applies_to_all_countries.eq.true,${textMatch})`;
  });
  return `or(${branches.join(",")})`;
}

/** Worldwide text match (no country filter). Pass as a single `.or(...)` clause. */
export function lawsGlobalTextIlikeOrTerms(escapedTerms: string[]): string {
  const terms = escapedTerms.map((t) => t.trim()).filter(Boolean);
  if (terms.length === 0) return "";
  return terms.map((esc) => `or(${lawTextIlikeOr(esc)})`).join(",");
}
