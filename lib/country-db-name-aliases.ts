/**
 * User-facing labels that differ from `countries.name` in Postgres.
 * Extend this list when common English or alternate spellings should resolve to one DB row.
 */
export type CountryDbAliasGroup = {
  /** Exact value of `countries.name` */
  dbName: string;
  /** Matched against user/query text */
  patterns: readonly RegExp[];
};

export const COUNTRY_DB_ALIAS_GROUPS: readonly CountryDbAliasGroup[] = [
  { dbName: "Cabo Verde", patterns: [/\bcape\s+verde\b/i, /\bcabo\s+verde\b/i] },
];

function normalizeCountrySlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Map filter params, hints, or UI strings to the exact `countries.name` for Supabase `.eq("name", …)`. */
export function resolveUserCountryNameToDbName(input: string): string {
  const t = input.trim();
  if (!t) return t;
  const slug = normalizeCountrySlug(t);
  for (const { dbName, patterns } of COUNTRY_DB_ALIAS_GROUPS) {
    if (normalizeCountrySlug(dbName) === slug) return dbName;
    for (const re of patterns) {
      if (re.test(t)) return dbName;
    }
  }
  if (slug === "capeverde" || slug === "caboverde") return "Cabo Verde";
  return t;
}

/** If the query names a country by a non-DB alias, return canonical `countries.name`. */
export function detectCountryAliasFromQueryText(query: string): string | undefined {
  if (!query?.trim()) return undefined;
  for (const { dbName, patterns } of COUNTRY_DB_ALIAS_GROUPS) {
    for (const re of patterns) {
      if (re.test(query)) return dbName;
    }
  }
  return undefined;
}
