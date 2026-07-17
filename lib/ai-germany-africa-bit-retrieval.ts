import { escapeIlikePattern } from "@/lib/law-country-scope";

/** Max excerpts for Germany–Africa BIT inventory / comparison turns. */
export const GERMANY_AFRICA_BIT_CATALOG_MAX_DOCS = 40;

const GERMANY_PARTY =
  /\b(germany|german|deutschland|bundesrepublik|federal\s+republic\s+of\s+germany)\b/i;

const AFRICA_REGION = /\b(africa|african)\b/i;

const BIT_INSTRUMENT =
  /\b(bit|bits|bilateral\s+investment|investment\s+treat(y|ies)|promotion\s+and\s+(reciprocal\s+)?protection|reciprocal\s+protection\s+of\s+investments|encouragement\s+and\s+reciprocal)\b/i;

export type GermanyAfricaBitRow = {
  id: string;
  title: string;
  country: string;
  status: string;
};

/**
 * User is asking about bilateral investment treaties between Germany and African states.
 */
export function detectGermanyAfricaBitQuery(raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (q.length < 10) return false;
  if (!GERMANY_PARTY.test(q)) return false;

  const africa = AFRICA_REGION.test(q);
  const bit = BIT_INSTRUMENT.test(q);
  const between =
    /\bbetween\b/.test(q) && GERMANY_PARTY.test(q) && (africa || /\bcountries\b/.test(q));

  return (africa && (bit || between)) || (bit && africa);
}

/** Count / list inventory — answered from the database without guessing from RAG snippets. */
export function isGermanyAfricaBitCountRequest(raw: string): boolean {
  if (!detectGermanyAfricaBitQuery(raw)) return false;
  const q = raw.trim().toLowerCase();
  const asksCount =
    /\b(count|how\s+many|number\s+of|total)\b/.test(q) ||
    (/\b(list|show|which|what)\b/.test(q) && BIT_INSTRUMENT.test(q));
  return asksCount;
}

/** Yamalé titles name Germany as a party to a bilateral investment instrument with an African state. */
export function titleLooksLikeGermanyAfricaBit(title: string): boolean {
  const t = title.trim();
  if (t.length < 8) return false;
  const lower = t.toLowerCase();
  if (
    !/\b(germany|deutschland|bundesrepublik|federal\s+republic\s+of\s+germany)\b/i.test(lower)
  ) {
    return false;
  }
  if (/\baustria\b/.test(lower) && !/\bgermany\b/.test(lower)) return false;
  if (/\bnetherlands\b/.test(lower) && !/\bgermany\b/.test(lower)) return false;
  return true;
}

export function titleLikelyGermanyAfricaBit(title: string): boolean {
  return titleLooksLikeGermanyAfricaBit(title);
}

/**
 * Pull non-repealed laws whose titles reference Germany as a BIT-style party.
 * Scoped to the library’s Germany–Africa naming convention (e.g. `Germany - Angola`).
 */
export async function fetchGermanyAfricaBitInventory(
  supabase: { from: (t: string) => any }
): Promise<GermanyAfricaBitRow[]> {
  const { data, error } = await supabase
    .from("laws")
    .select("id, title, status, countries(name)")
    .ilike("title", `%${escapeIlikePattern("germany")}%`)
    .neq("status", "Repealed").neq("status", "Superseded")
    .order("title", { ascending: true })
    .limit(120);

  if (error) {
    console.error("[AI RAG] Germany–Africa BIT inventory fetch:", error.message ?? error);
    return [];
  }

  return ((data ?? []) as any[])
    .filter((row) => titleLooksLikeGermanyAfricaBit(String(row.title ?? "")))
    .map((row) => ({
      id: String(row.id),
      title: String(row.title ?? "").replace(/\s+/g, " ").trim(),
      country: String(row.countries?.name ?? "").trim() || "—",
      status: String(row.status ?? "").trim() || "In force",
    }));
}

export async function fetchGermanyAfricaBitTitleCandidates(
  supabase: { from: (t: string) => any },
  query: string,
  lawsAiSelect: string
): Promise<any[]> {
  if (!detectGermanyAfricaBitQuery(query)) return [];
  const rows = await fetchGermanyAfricaBitInventory(supabase);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id).slice(0, 80);
  const { data, error } = await supabase
    .from("laws")
    .select(lawsAiSelect)
    .in("id", ids)
    .not("content", "is", null)
    .neq("status", "Repealed").neq("status", "Superseded");

  if (error) {
    console.error("[AI RAG] Germany–Africa BIT body fetch:", error.message ?? error);
    return [];
  }
  return (data ?? []) as any[];
}

export function germanyAfricaBitRankingLexicon(): string[] {
  return [
    "germany",
    "german",
    "deutschland",
    "bit",
    "bilateral",
    "investment",
    "treaty",
    "encouragement",
    "reciprocal",
    "protection",
  ];
}

/** Authoritative metadata block for the system prompt (titles only). */
export function buildGermanyAfricaBitInventoryPromptBlock(rows: GermanyAfricaBitRow[]): string {
  if (rows.length === 0) return "";
  const lines = rows.map(
    (r, i) => `${i + 1}. ${r.title} | ${r.country} | ${r.status}`
  );
  return `AUTHORITATIVE INVENTORY — Germany–Africa bilateral investment treaties in Yamalé (${rows.length} non-repealed instruments):

Use this list for **counts**, coverage, and spelling. The library names these instruments as "{Country} - Germany", "Germany - {Country}", or a long-form "Treaty Between the Federal Republic of Germany and…" caption. Do **not** under-count: the total below is from the live database, not from excerpt guessing. Quote operative legal text only from RETRIEVED document bodies.

${lines.join("\n")}`;
}

/** Formatted assistant reply for count / list questions (no Claude call). */
export function formatGermanyAfricaBitCountResponse(rows: GermanyAfricaBitRow[]): string {
  const n = rows.length;
  if (n === 0) {
    return (
      "I did not find any non-repealed Germany–Africa bilateral investment treaties in the Yamalé library matching the usual title patterns. " +
      "Try browsing **Library** (/library) with the International Trade Laws category or search for a specific African partner state and \"Germany\"."
    );
  }

  const byCountry = new Map<string, GermanyAfricaBitRow[]>();
  for (const row of rows) {
    const key = row.country;
    const list = byCountry.get(key) ?? [];
    list.push(row);
    byCountry.set(key, list);
  }
  const partnerCount = byCountry.size;

  const tableLines = [...byCountry.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([country, items]) =>
      items.map((r) => `| ${country} | ${r.title} | ${r.status} |`)
    );

  const duplicateNote =
    partnerCount < n
      ? `\n\n**Note:** ${n} instruments are on file for **${partnerCount}** African partner states (some countries have more than one Germany treaty entry, e.g. different years or title variants).`
      : "";

  return (
    `According to the **Yamalé library database**, there are **${n}** non-repealed bilateral investment treaties between **Germany** and **African countries** on file.${duplicateNote}\n\n` +
    `They are catalogued under titles such as \`Germany - Angola\`, \`Algeria - Germany\`, or long-form Federal Republic of Germany captions.\n\n` +
    `| African partner | Title in library | Status |\n| --- | --- | --- |\n` +
    tableLines.join("\n") +
    `\n\nFor full operative text of a specific treaty, open **Library** (/library), filter by the partner country or search **Germany** and the country name.`
  );
}
