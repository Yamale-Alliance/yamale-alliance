/**
 * User-facing labels that differ from `countries.name` in Postgres.
 * Extend this list when common English or alternate spellings should resolve to one DB row.
 *
 * Order matters for `detectCountryAliasFromQueryText`: the first matching group wins.
 * Put more specific / easily confused pairs before generic ones when patterns could overlap.
 */
export type CountryDbAliasGroup = {
  /** Exact value of `countries.name` */
  dbName: string;
  /** Matched against user/query text */
  patterns: readonly RegExp[];
};

export const COUNTRY_DB_ALIAS_GROUPS: readonly CountryDbAliasGroup[] = [
  {
    dbName: "Côte d'Ivoire",
    patterns: [
      /\bivory\s+coast\b/i,
      /\bcôte\s+d['' ]?ivoire\b/i,
      /\bcote\s+d['' ]?ivoire\b/i,
      /\bcote\s+divoire\b/i,
      /\bcôte\s+divoire\b/i,
    ],
  },
  { dbName: "Cabo Verde", patterns: [/\bcape\s+verde\b/i, /\bcabo\s+verde\b/i] },
];

export function normalizeCountrySlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Levenshtein distance (small strings only; for typo tolerance on country names). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n]!;
}

/**
 * If the user typed a single token very close to exactly one country slug (e.g. "kenys" → Kenya),
 * return that DB name; otherwise null. Requires a clear winner (distance ≤ 1 vs next best ≥ 2).
 */
export function fuzzyResolveUserTypedCountryName(
  input: string,
  countryNames: readonly string[]
): string | null {
  const t = input.trim();
  if (!t || /\s/.test(t)) return null;
  const slug = normalizeCountrySlug(t);
  if (slug.length < 4 || slug.length > 14) return null;

  let best: { name: string; d: number } | null = null;
  let second = Infinity;
  for (const name of countryNames) {
    const ns = normalizeCountrySlug(name);
    if (ns.length < 4) continue;
    const d = levenshtein(slug, ns);
    if (d < (best?.d ?? Infinity)) {
      second = best?.d ?? Infinity;
      best = { name, d };
    } else if (d < second) second = d;
  }
  if (best && best.d <= 1 && second >= 2) return best.name;
  return null;
}

/**
 * When the full query is normalized to a single slug, find a DB country whose slug appears inside it.
 * Uses longest slug first so "nigeria" wins over "niger". Skips very short slugs to reduce noise.
 */
export function findDbCountryNameBySlugInQuery(
  query: string,
  countryNames: readonly string[],
  minSlugLen = 6
): string | undefined {
  const querySlug = normalizeCountrySlug(query);
  if (querySlug.length < minSlugLen) return undefined;
  const ranked = countryNames
    .map((name) => ({ name, slug: normalizeCountrySlug(name) }))
    .filter((x) => x.slug.length >= minSlugLen)
    .sort((a, b) => b.slug.length - a.slug.length);
  for (const { name, slug } of ranked) {
    if (querySlug.includes(slug)) return name;
  }
  return undefined;
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
  if (slug === "ivorycoast" || slug === "cotedivoire") return "Côte d'Ivoire";
  return t;
}

/** If the query names a country by a non-DB alias, return canonical `countries.name` (first match in group order). */
export function detectCountryAliasFromQueryText(query: string): string | undefined {
  if (!query?.trim()) return undefined;
  for (const { dbName, patterns } of COUNTRY_DB_ALIAS_GROUPS) {
    for (const re of patterns) {
      if (re.test(query)) return dbName;
    }
  }
  return undefined;
}

/** All alias groups that match the query (for bilateral / multi-country extraction). */
export function detectAllCountryAliasesFromQuery(query: string): string[] {
  if (!query?.trim()) return [];
  const out: string[] = [];
  for (const { dbName, patterns } of COUNTRY_DB_ALIAS_GROUPS) {
    for (const re of patterns) {
      if (re.test(query)) {
        out.push(dbName);
        break;
      }
    }
  }
  return out;
}
