import { escapeIlikePattern } from "@/lib/law-country-scope";

/** Max laws returned to the client and in the system prompt for broad Latin-America treaty inventory questions. */
export const LATIN_AMERICA_TREATY_CATALOG_MAX_DOCS = 32;

/**
 * English / common treaty-title spellings for Latin America & the Caribbean.
 * Used only for retrieval (titles are rarely accented consistently).
 */
const LATIN_AMERICA_TITLE_SEARCH_NAMES = [
  "Argentina",
  "Bolivia",
  "Brazil",
  "Brasil",
  "Chile",
  "Colombia",
  "Costa Rica",
  "Cuba",
  "Dominican Republic",
  "Ecuador",
  "El Salvador",
  "Guatemala",
  "Guyana",
  "Haiti",
  "Honduras",
  "Jamaica",
  "Mexico",
  "México",
  "Nicaragua",
  "Panama",
  "Panamá",
  "Paraguay",
  "Peru",
  "Perú",
  "Suriname",
  "Trinidad",
  "Tobago",
  "Uruguay",
  "Venezuela",
  "Bahamas",
  "Barbados",
  "Belize",
  "Grenada",
  "Saint Lucia",
  "Saint Kitts",
  "Antigua",
  "MERCOSUR",
  "Mercosur",
  "Andean",
  "ALADI",
  "Caricom",
  "CARICOM",
] as const;

/** Treaties / economic instruments — title or lead-in body must look like one. */
const LATIN_AMERICA_TREATY_SIGNAL =
  /\b(investment|treaty|treaties|bilateral|trilateral|agreement|acuerdo|accord|convention|protocol|pact|promotion\s+and\s+protection|protection\s+of\s+investments|economic\s+partnership|free\s+trade|trade\s+and\s+investment|friendship\s+commerce|navigation|double\s+taxation|tax\s+treaty|air\s+services|maritime)\b/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** User asked about Latin America / Caribbean as a region (not only a single named state). */
export function detectLatinAmericaTreatyDiscoveryQuery(raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (q.length < 10) return false;
  const region =
    /\blatin\s+america\b/.test(q) ||
    /\blatam\b/.test(q) ||
    /\blatin\s+american\b/.test(q) ||
    /\bsouth\s+american\b/.test(q) ||
    /\bsouth\s+america\b/.test(q) ||
    /\bcentral\s+america\b/.test(q) ||
    /\bcentral\s+american\b/.test(q) ||
    /\bcaribbean\b/.test(q) ||
    /\b(mercosur|andean|cafta|aladi|caricom)\b/.test(q);
  if (!region) return false;
  const instrument =
    /\b(treat|treaties|treaty|investment|bit|bilateral|trilateral|agreement|accord|acuerdo|convention|protocol|pact|trade)\b/.test(q) ||
    /\b(in\s+your\s+database|in\s+the\s+database|in\s+the\s+library|do\s+you\s+have)\b/.test(q) ||
    (/\b(some|any|what)\b/.test(q) && /\b(treat|treaties|treaty)\b/.test(q)) ||
    /\b(show|list|give)\s+(me\s+)?(everything|all)\b/.test(q);
  return instrument;
}

/**
 * Latin American / Caribbean country or bloc names explicitly mentioned in the query.
 * Longest-first so "Costa Rica" wins over "Rica".
 */
export function extractLatinAmericanCountryMentionsFromQuery(raw: string): string[] {
  const q = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const sorted = [...LATIN_AMERICA_TITLE_SEARCH_NAMES].sort((a, b) => b.length - a.length);
  const found: string[] = [];
  const seen = new Set<string>();
  for (const name of sorted) {
    const n = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    if (n.length < 4) continue;
    const re =
      n.includes(" ") || n.includes("-")
        ? new RegExp(escapeRegExp(n), "i")
        : new RegExp(`\\b${escapeRegExp(n)}\\b`, "i");
    if (!re.test(q)) continue;
    const canon = name.replace(/[’']/g, "'").trim();
    const key = canon.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(canon);
    if (found.length >= 8) break;
  }
  return found;
}

function titleOrSnippetLooksLikeTreaty(title: string, contentHead: string): boolean {
  const head = contentHead.slice(0, 12_000);
  return LATIN_AMERICA_TREATY_SIGNAL.test(title) || LATIN_AMERICA_TREATY_SIGNAL.test(head);
}

function titleReferencesLatinAmerica(title: string, extraNames: readonly string[]): boolean {
  const t = title.toLowerCase();
  const pool = new Set<string>(
    [...LATIN_AMERICA_TITLE_SEARCH_NAMES, ...extraNames].map((x) => x.toLowerCase().normalize("NFD").replace(/\p{M}/gu, ""))
  );
  for (const n of pool) {
    if (n.length < 4) continue;
    const re = n.includes(" ") ? new RegExp(escapeRegExp(n), "i") : new RegExp(`\\b${escapeRegExp(n)}\\b`, "i");
    if (re.test(t)) return true;
  }
  return false;
}

/** True if the law title names a Latin American / Caribbean jurisdiction or bloc (treaty signal not required). */
export function titleLikelyLatinAmericaTreaty(title: string): boolean {
  return titleReferencesLatinAmerica(title, []);
}

/**
 * Pull laws whose **title** mentions a Latin American / Caribbean state or bloc,
 * then keep rows that look like treaties or international economic instruments.
 * Merged into AI chat `titleMatchedLaws` so they rank with other metadata-aware hits.
 */
export async function fetchLatinAmericaTreatyTitleCandidates(
  supabase: { from: (t: string) => any },
  query: string,
  lawsAiSelect: string
): Promise<any[]> {
  const explicit = extractLatinAmericanCountryMentionsFromQuery(query);
  const discovery = detectLatinAmericaTreatyDiscoveryQuery(query);
  if (!discovery && explicit.length === 0) return [];

  const namesForOr =
    explicit.length > 0
      ? explicit
      : Array.from(new Set(LATIN_AMERICA_TITLE_SEARCH_NAMES as unknown as string[]));

  const orParts = namesForOr
    .slice(0, 50)
    .map((n) => `title.ilike.%${escapeIlikePattern(n)}%`)
    .filter((p) => p.length > 8);

  if (orParts.length === 0) return [];

  const { data, error } = await supabase
    .from("laws")
    .select(lawsAiSelect)
    .not("content", "is", null)
    .neq("status", "Repealed")
    .or(orParts.join(","))
    .limit(380);

  if (error) {
    console.error("[AI RAG] Latin America treaty title fetch:", error.message ?? error);
    return [];
  }

  const rows = (data ?? []) as any[];
  const out: any[] = [];
  for (const row of rows) {
    const title = String(row.title ?? "");
    const plain = String(row.content_plain ?? row.content ?? "");
    if (!titleReferencesLatinAmerica(title, explicit)) continue;
    if (!titleOrSnippetLooksLikeTreaty(title, plain)) continue;
    out.push(row);
  }
  return out.slice(0, 220);
}

/** Extra ranking tokens when a Latin-America treaty query is active. */
export function latinAmericaTreatyRankingLexicon(query: string): string[] {
  const mentions = extractLatinAmericanCountryMentionsFromQuery(query);
  if (!detectLatinAmericaTreatyDiscoveryQuery(query) && mentions.length === 0) return [];
  return dedupeLower([
    ...mentions,
    "investment",
    "treaty",
    "treaties",
    "agreement",
    "bilateral",
    "bit",
    "acuerdo",
    "accord",
    "promotion",
    "protection",
    "mercosur",
    "andean",
    "caricom",
  ]);
}

function dedupeLower(arr: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const k = x.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
