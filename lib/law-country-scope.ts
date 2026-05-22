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

/** Multi-word phrases use chained `%` so PostgREST does not break on spaces in filter values. */
export function postgrestIlikePattern(raw: string): string {
  const escaped = escapeIlikePattern(raw.toLowerCase().trim());
  return ilikePatternCore(escaped);
}

function ilikePatternCore(escapedLowerTerms: string): string {
  const parts = escapedLowerTerms
    .split(/\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  if (parts.length <= 1) return escapedLowerTerms;
  return parts.join("%");
}

/** Title, HTML body, and plain text (preferred for matching OCR/plain bodies). */
export function lawTextIlikeOr(escapedLowerTerms: string): string {
  const pattern = ilikePatternCore(escapedLowerTerms);
  return `title.ilike.%${pattern}%,content.ilike.%${pattern}%,content_plain.ilike.%${pattern}%`;
}

/**
 * Flat PostgREST `.or()` branches — one `and()` per column per scope.
 * PostgREST rejects `and(X, or(A,B,C))` — nested or() inside and() causes 400 Bad Request.
 * Correct form: `and(X,A),and(X,B),and(X,C)` — flat list only.
 */
function countryGlobalTextBranches(countryId: string, escapedTerm: string): string[] {
  const pattern = `%${ilikePatternCore(escapedTerm)}%`;
  const cols = ["title", "content", "content_plain"] as const;
  const branches: string[] = [];
  for (const col of cols) {
    branches.push(`and(country_id.eq.${countryId},${col}.ilike.${pattern})`);
    branches.push(`and(applies_to_all_countries.eq.true,${col}.ilike.${pattern})`);
  }
  return branches;
}

export function lawsCountryOrGlobalWithTextSearch(countryId: string, escapedLowerTerms: string): string {
  return countryGlobalTextBranches(countryId, escapedLowerTerms).join(",");
}

/**
 * OR of several country+global scoped text searches — used when the user asks a factual
 * question (e.g. minimum wage) so we match any salient token, not only the full sentence.
 * Return value is passed directly to `.or(...)` — must be a flat comma-separated list.
 *
 * Each token produces 6 branches (3 cols × 2 scopes). Budget cap in postgrest-ilike-tokens.ts
 * typically allows 1–2 tokens for full 3-column search.
 */
export function lawsCountryOrGlobalWithAnyEscapedTerms(countryId: string, escapedTerms: string[]): string {
  const terms = escapedTerms.map((t) => t.trim()).filter(Boolean);
  if (terms.length === 0) return lawsOrGlobalForCountry(countryId);
  return terms.flatMap((esc) => countryGlobalTextBranches(countryId, esc)).join(",");
}

/**
 * Title + HTML body token match (excludes content_plain to keep primary queries lighter).
 */
export function lawsCountryOrGlobalWithTitleContentTerms(countryId: string, escapedTerms: string[]): string {
  const terms = escapedTerms.map((t) => t.trim()).filter(Boolean);
  if (terms.length === 0) return lawsOrGlobalForCountry(countryId);
  return terms
    .flatMap((esc) => {
      const pattern = `%${ilikePatternCore(esc)}%`;
      return [
        `and(country_id.eq.${countryId},title.ilike.${pattern})`,
        `and(applies_to_all_countries.eq.true,title.ilike.${pattern})`,
        `and(country_id.eq.${countryId},content.ilike.${pattern})`,
        `and(applies_to_all_countries.eq.true,content.ilike.${pattern})`,
      ];
    })
    .join(",");
}

/**
 * Title-only token match, scoped to one country OR global instruments.
 * Uses the same flat and()-per-column pattern for consistency.
 */
export function lawsCountryOrGlobalWithTitleTerms(countryId: string, titleTerms: string[]): string {
  const esc = titleTerms
    .map((t) => escapeIlikePattern(t.toLowerCase().trim()))
    .filter((t) => t.length >= 2);
  if (esc.length === 0) return lawsOrGlobalForCountry(countryId);
  return esc
    .flatMap((e) => [
      `and(country_id.eq.${countryId},title.ilike.%${e}%)`,
      `and(applies_to_all_countries.eq.true,title.ilike.%${e}%)`,
    ])
    .join(",");
}

/** Worldwide text match (no country filter). Flat list for `.or(...)`. */
export function lawsGlobalTextIlikeOrTerms(escapedTerms: string[]): string {
  const terms = escapedTerms.map((t) => t.trim()).filter(Boolean);
  if (terms.length === 0) return "";
  return terms.flatMap((esc) => {
    const pattern = `%${ilikePatternCore(esc)}%`;
    return [
      `title.ilike.${pattern}`,
      `content.ilike.${pattern}`,
      `content_plain.ilike.${pattern}`,
    ];
  }).join(",");
}
