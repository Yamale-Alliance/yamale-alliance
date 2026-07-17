import { isValidLawYear } from "@/lib/admin-law-utils";
import { detectCountryInvestmentOverviewQuery } from "@/lib/ai-country-investment-retrieval";
import { isMultiInstrumentListQuery } from "@/lib/ai-rag-context-budget";
import { detectGermanyAfricaBitQuery } from "@/lib/ai-germany-africa-bit-retrieval";
import { detectLatinAmericaTreatyDiscoveryQuery } from "@/lib/ai-latin-america-treaty-retrieval";
import { detectGlobalTreatyInventoryQuery, titleLooksLikeCrossBorderTreatyTitle } from "@/lib/ai-treaty-catalog-retrieval";
import { resolveCountryIdCached } from "@/lib/country-resolution-cache";
import { escapeIlikePattern, lawsOrGlobalForCountry } from "@/lib/law-country-scope";
import { lawSourceDisplayLabel } from "@/lib/law-source-display";

/** Max excerpts hydrated for country bilateral inventory turns. */
export const COUNTRY_BILATERAL_INVENTORY_MAX_DOCS = 36;

const INTERNATIONAL_TRADE_CATEGORY = "International Trade Laws";

const BILATERAL_INSTRUMENT =
  /\b(bilateral|bit|bits|treat(y|ies)|agreement|accord|trade\s+and\s+investment|investment\s+promotion|double\s+taxation|tax\s+convention|friendship\s+commerce)\b/i;

export type CountryBilateralTreatyRow = {
  id: string;
  title: string;
  counterparty: string;
  category: string;
  year: number | null;
  status: string;
  source: string;
};

export type YearWindowFilter = {
  minYear: number;
  label: string;
};

/** User wants a country-scoped list of bilateral / trade treaties (not Germany–Africa or global-only). */
export function detectCountryBilateralInventoryQuery(
  raw: string,
  countryName: string | null | undefined
): boolean {
  if (!countryName?.trim()) return false;
  if (
    detectGermanyAfricaBitQuery(raw) ||
    detectLatinAmericaTreatyDiscoveryQuery(raw) ||
    detectGlobalTreatyInventoryQuery(raw)
  ) {
    return false;
  }
  const q = raw.trim().toLowerCase();
  if (q.length < 12) return false;
  if (detectCountryInvestmentOverviewQuery(raw, countryName)) return true;
  if (!BILATERAL_INSTRUMENT.test(q)) return false;

  return (
    isMultiInstrumentListQuery(raw) ||
    /\b(what are|which|list|show|all|every|signed|concluded|entered|have|inventory)\b/.test(q)
  );
}

/** Parse "last 15 years", "since 2010", or explicit 2010–2025 ranges. */
export function parseYearWindowFromQuery(
  raw: string,
  referenceYear = new Date().getFullYear()
): YearWindowFilter | null {
  const q = raw.toLowerCase();
  const lastYears = q.match(/\b(?:in\s+the\s+)?last\s+(\d{1,2})\s+years?\b/);
  if (lastYears) {
    const n = Number.parseInt(lastYears[1]!, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 100) {
      return { minYear: referenceYear - n + 1, label: `last ${n} years (from ${referenceYear - n + 1})` };
    }
  }
  const since = q.match(/\bsince\s+(19|20)\d{2}\b/);
  if (since) {
    const y = Number.parseInt(since[0]!.replace(/\D/g, ""), 10);
    if (Number.isFinite(y)) return { minYear: y, label: `since ${y}` };
  }
  const range = q.match(/\b(19|20)\d{2}\s*[-–]\s*((?:19|20)\d{2})\b/);
  if (range) {
    const minYear = Number.parseInt(range[0]!.slice(0, 4), 10);
    if (Number.isFinite(minYear)) return { minYear, label: `from ${range[0]}` };
  }
  return null;
}

const COUNTRY_TITLE_ALIASES: Record<string, string[]> = {
  tanzania: ["tanzania", "united republic of tanzania"],
  "côte d'ivoire": ["côte d'ivoire", "cote d'ivoire", "ivory coast"],
  "cote d'ivoire": ["côte d'ivoire", "cote d'ivoire", "ivory coast"],
};

function countryTokens(countryName: string): string[] {
  const key = countryName.trim().toLowerCase();
  const base = [key, ...key.split(/\s+/).filter((w) => w.length >= 4)];
  const aliases = COUNTRY_TITLE_ALIASES[key] ?? [];
  return Array.from(new Set([...base, ...aliases].map((t) => t.toLowerCase()))).filter(
    (t) => t.length >= 4 || t === "eac"
  );
}

function titleMentionsCountry(title: string, countryName: string): boolean {
  const t = title.toLowerCase();
  return countryTokens(countryName).some((token) => t.includes(token));
}

export function titleLikelyCountryBilateralTreaty(title: string, countryName: string): boolean {
  const t = title.trim();
  if (t.length < 8) return false;
  if (!titleLooksLikeCrossBorderTreatyTitle(t) && !/\bbilateral\b/i.test(t)) return false;
  if (!titleMentionsCountry(t, countryName)) return false;
  if (/\b(act|proclamation|decree|regulation|statute)\s+no\.?\s*\d/i.test(t.toLowerCase())) {
    if (!/\b(treaty|agreement|between)\b/i.test(t)) return false;
  }
  return true;
}

/** Best-effort counterparty from "Canada - Tanzania …" or "Agreement between X and Y". */
export function inferTreatyCounterparty(title: string, homeCountry: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  const homeTokens = countryTokens(homeCountry);

  if (/\s[-–—]\s/.test(t)) {
    const parts = t.split(/\s[-–—]\s/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (homeTokens.some((h) => lower.includes(h))) continue;
      const cleaned = part
        .replace(/\b(bilateral\s+investment\s+treaty|bit|agreement|treaty)\b/gi, "")
        .replace(/\s*[-–—]\s*(?:19|20)\d{2}\s*$/i, "")
        .trim();
      if (cleaned.length >= 2) return cleaned.slice(0, 80);
    }
  }

  const between = t.match(/\bbetween\s+(.+?)\s+and\s+(.+?)(?:\s*[-–—]|\s*$)/i);
  if (between) {
    for (const part of [between[1]!, between[2]!]) {
      const lower = part.toLowerCase();
      if (homeTokens.some((h) => lower.includes(h))) continue;
      return part.trim().slice(0, 80);
    }
  }

  return "—";
}

function parseLawYear(row: { year?: number | null; title?: string | null }): number | null {
  if (typeof row.year === "number" && isValidLawYear(row.year)) return row.year;
  const fromTitle = String(row.title ?? "").match(/\b(18|19|20)\d{2}\b/);
  if (fromTitle) {
    const y = Number.parseInt(fromTitle[0], 10);
    if (Number.isFinite(y)) return y;
  }
  return null;
}

/**
 * All non-repealed bilateral / cross-border treaty titles for a country in Yamalé
 * (metadata from live DB — not RAG excerpt guessing).
 */
export async function fetchCountryBilateralTreatyInventory(
  supabase: { from: (t: string) => any },
  countryName: string
): Promise<CountryBilateralTreatyRow[]> {
  const countryId = await resolveCountryIdCached(countryName);
  if (!countryId) return [];

  const countryToken = escapeIlikePattern(countryName.split(/\s+/)[0]!.toLowerCase());
  const scopeOr = `${lawsOrGlobalForCountry(countryId)},title.ilike.%${countryToken}%`;
  const { data, error } = await supabase
    .from("laws")
    .select(
      "id, title, year, status, source_name, applies_to_all_countries, country_id, countries(name), categories!laws_category_id_fkey(name)"
    )
    .or(scopeOr)
    .neq("status", "Repealed").neq("status", "Superseded")
    .order("title", { ascending: true })
    .limit(500);

  if (error) {
    console.error("[AI RAG] Country bilateral inventory:", error.message ?? error);
    return [];
  }

  const seen = new Set<string>();
  const rows: CountryBilateralTreatyRow[] = [];

  for (const row of (data ?? []) as any[]) {
    const title = String(row.title ?? "").replace(/\s+/g, " ").trim();
    if (!title) continue;
    const cat = String(row.categories?.name ?? "").trim();
    const isTradeCat = cat === INTERNATIONAL_TRADE_CATEGORY;
    if (!isTradeCat && !titleLikelyCountryBilateralTreaty(title, countryName)) continue;
    if (!titleLikelyCountryBilateralTreaty(title, countryName) && !/\bbilateral\b/i.test(title)) {
      continue;
    }
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      id: String(row.id),
      title,
      counterparty: inferTreatyCounterparty(title, countryName),
      category: cat || INTERNATIONAL_TRADE_CATEGORY,
      year: parseLawYear(row),
      status: String(row.status ?? "").trim() || "In force",
      source:
        lawSourceDisplayLabel(row) ||
        String(row.countries?.name ?? "").trim() ||
        countryName,
    });
  }

  rows.sort((a, b) => {
    const ya = a.year ?? 0;
    const yb = b.year ?? 0;
    if (yb !== ya) return yb - ya;
    return a.counterparty.localeCompare(b.counterparty);
  });

  return rows;
}

export async function fetchCountryBilateralTreatyTitleCandidates(
  supabase: { from: (t: string) => any },
  countryName: string,
  query: string,
  lawsAiSelect: string
): Promise<any[]> {
  if (!detectCountryBilateralInventoryQuery(query, countryName)) return [];
  const inventory = await fetchCountryBilateralTreatyInventory(supabase, countryName);
  if (inventory.length === 0) return [];

  const ids = inventory.map((r) => r.id).slice(0, 80);
  const { data, error } = await supabase
    .from("laws")
    .select(lawsAiSelect)
    .in("id", ids)
    .not("content", "is", null)
    .neq("status", "Repealed").neq("status", "Superseded");

  if (error) {
    console.error("[AI RAG] Country bilateral body fetch:", error.message ?? error);
    return [];
  }
  return (data ?? []) as any[];
}

export function countryBilateralInventoryRankingLexicon(countryName: string): string[] {
  const tokens = countryTokens(countryName).slice(0, 4);
  return [
    ...tokens,
    "bilateral",
    "treaty",
    "treaties",
    "agreement",
    "investment",
    "trade",
    "bit",
    "signed",
  ];
}

export function buildCountryBilateralInventoryPromptBlock(
  rows: CountryBilateralTreatyRow[],
  opts: { countryName: string; yearWindow?: YearWindowFilter | null }
): string {
  if (rows.length === 0) return "";

  const { countryName, yearWindow } = opts;
  const inWindow = yearWindow
    ? rows.filter((r) => r.year == null || r.year >= yearWindow.minYear)
    : rows;
  const olderInForce = yearWindow
    ? rows.filter((r) => r.year != null && r.year < yearWindow.minYear && /in\s+force/i.test(r.status))
    : [];

  const formatLine = (r: CountryBilateralTreatyRow, i: number) => {
    const year = r.year != null ? String(r.year) : "year not in metadata";
    return `${i + 1}. ${r.counterparty} | ${r.title} | ${r.category} | ${year} | ${r.status}`;
  };

  const primaryLines = (yearWindow ? inWindow : rows).map(formatLine);
  const olderLines = olderInForce.map(formatLine);

  let body = `AUTHORITATIVE INVENTORY — Bilateral / cross-border trade & investment instruments for **${countryName}** in Yamalé (${rows.length} non-repealed titles in the live database):

Use this list as the **complete inventory** for list / coverage questions. Do **not** tell the user Yamalé has "only one treaty" or "no library content" when multiple titles appear here. For investment overview questions, also cover the national investment code and any **regional** instruments in the RETRIEVED blocks (e.g. ECOWAS, AfCFTA, SADC) — not only one bilateral treaty. Do **not** tell the user to browse /library to discover what is already listed here. Quote operative clauses only from RETRIEVED document bodies below; for metadata (counterparty, year, status) use this block.

Columns: Counterparty | Title | Category | Year | Status

${primaryLines.join("\n")}`;

  if (yearWindow) {
    body += `\n\nYear filter requested (${yearWindow.label}): **${inWindow.length}** instrument(s) match or have no year in metadata.`;
    if (olderLines.length > 0) {
      body += `\n\nOlder agreements still marked in force (outside ${yearWindow.label}) — mention briefly if the user cares about "still in force today":\n${olderLines.join("\n")}`;
    }
  }

  return body;
}
