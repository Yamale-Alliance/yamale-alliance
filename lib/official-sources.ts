import { normalizeCountrySlug, resolveUserCountryNameToDbName } from "@/lib/country-db-name-aliases";
import { getSupabaseServer } from "@/lib/supabase/server";

export const OFFICIAL_SOURCE_CATEGORIES = [
  "Tax Authority",
  "Labor / Minimum Wage",
  "Business Registration",
  "Investment Promotion",
  "Customs and Trade",
  "Official Gazette / Law Database",
] as const;

export type OfficialSourceCategory = (typeof OFFICIAL_SOURCE_CATEGORIES)[number];

export type OfficialSourceRow = {
  agency_name: string;
  url: string | null;
  notes: string | null;
  country: string;
  region: string | null;
  category: OfficialSourceCategory;
};

const CATEGORY_SET = new Set<string>(OFFICIAL_SOURCE_CATEGORIES);

export function isOfficialSourceCategory(value: string): value is OfficialSourceCategory {
  return CATEGORY_SET.has(value);
}

/** Normalize sheet / user country labels to stored `countries.name` where possible. */
export function normalizeOfficialSourceCountryName(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return resolveUserCountryNameToDbName(t);
}

export function countriesMatchForOfficialSource(a: string, b: string): boolean {
  const na = normalizeCountrySlug(normalizeOfficialSourceCountryName(a));
  const nb = normalizeCountrySlug(normalizeOfficialSourceCountryName(b));
  return na.length > 0 && na === nb;
}

const INVALID_URL_MARKERS = [
  "not online",
  "not available",
  "facebook only",
  "no online",
  "offline only",
  "n/a",
  "na",
];

/** Returns null when URL should not be stored or linked. */
export function sanitizeOfficialSourceUrl(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (INVALID_URL_MARKERS.some((m) => lower === m || lower.startsWith(`${m} `))) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^www\./i.test(t)) return `https://${t}`;
  if (/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}/i.test(t)) return `https://${t}`;
  return null;
}

export function inferOfficialSourceCategoryFromQuery(query: string): OfficialSourceCategory | null {
  const q = query.toLowerCase();
  if (
    /\b(tax|vat|withholding|income\s+tax|corporate\s+tax|firs|nrs|revenue\s+service|dgi)\b/.test(q)
  ) {
    return "Tax Authority";
  }
  if (
    /\b(labou?r|labor|employment|minimum\s+wage|wage|workplace|pension\s+contribution|social\s+security)\b/.test(
      q
    )
  ) {
    return "Labor / Minimum Wage";
  }
  if (
    /\b(register\s+(a\s+)?company|business\s+registration|incorporat|company\s+registry|rc\s+number|cac\b|guichet\s+unique)\b/.test(
      q
    )
  ) {
    return "Business Registration";
  }
  if (/\b(investment\s+promotion|invest\s+in|ipa\b|fdi|special\s+economic\s+zone)\b/.test(q)) {
    return "Investment Promotion";
  }
  if (/\b(customs|import\s+duty|export\s+duty|tariff|clearance|port\s+authority)\b/.test(q)) {
    return "Customs and Trade";
  }
  if (/\b(official\s+gazette|gazette|law\s+database|legal\s+database|statute\s+database)\b/.test(q)) {
    return "Official Gazette / Law Database";
  }
  return null;
}

function mapYamaleCategoryToOfficialSource(category: string | null | undefined): OfficialSourceCategory | null {
  if (!category?.trim()) return null;
  const c = category.toLowerCase();
  if (c.includes("tax")) return "Tax Authority";
  if (c.includes("labour") || c.includes("labor") || c.includes("employment")) return "Labor / Minimum Wage";
  if (c.includes("corporate") || c.includes("company")) return "Business Registration";
  if (c.includes("trade") || c.includes("customs")) return "Customs and Trade";
  if (c.includes("constitutional") || c.includes("administrative")) return "Official Gazette / Law Database";
  return null;
}

type DbOfficialSource = {
  country: string;
  region: string | null;
  category: string;
  agency_name: string;
  url: string | null;
  notes: string | null;
};

function toOfficialSourceRow(row: DbOfficialSource): OfficialSourceRow | null {
  if (!isOfficialSourceCategory(row.category)) return null;
  return {
    country: row.country,
    region: row.region,
    category: row.category,
    agency_name: row.agency_name,
    url: row.url,
    notes: row.notes,
  };
}

/**
 * Lookup one official agency row for a country + category (case- and diacritic-insensitive country match).
 */
export async function getOfficialSource(
  country: string,
  category: OfficialSourceCategory
): Promise<{ agency_name: string; url: string | null; notes: string | null } | null> {
  const resolvedCountry = normalizeOfficialSourceCountryName(country);
  if (!resolvedCountry) return null;

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("official_sources")
    .select("country, region, category, agency_name, url, notes")
    .eq("category", category);

  if (error) {
    console.error("[official-sources] getOfficialSource:", error.message);
    return null;
  }

  const match = (data as DbOfficialSource[] | null)?.find((row) =>
    countriesMatchForOfficialSource(row.country, resolvedCountry)
  );
  if (!match) return null;

  return {
    agency_name: match.agency_name,
    url: match.url,
    notes: match.notes,
  };
}

export function formatOfficialSourceVerificationBlock(
  row: { agency_name: string; url: string | null; notes: string | null } | null
): string {
  if (!row?.agency_name?.trim()) return "";

  const notes =
    row.notes?.trim() && row.notes.length > 0
      ? `\n\n_${row.notes.replace(/\s+/g, " ").trim()}_`
      : "";

  if (row.url) {
    return `\n\n---\n📎 Verify current information at the official source: [${row.agency_name}](${row.url})${notes}`;
  }

  return `\n\n---\n📎 Official source: ${row.agency_name} (online portal not available — verify in person or via official government channels)${notes}`;
}

/** After a substantive regulatory answer, append official verification when a row exists. */
export async function appendOfficialSourceVerificationToAnswer(params: {
  userQuery: string;
  country: string | null | undefined;
  yamaleCategory?: string | null;
  assistantAnswer: string;
}): Promise<string> {
  const country = params.country?.trim();
  if (!country) return params.assistantAnswer;

  const category =
    inferOfficialSourceCategoryFromQuery(params.userQuery) ??
    mapYamaleCategoryToOfficialSource(params.yamaleCategory);
  if (!category) return params.assistantAnswer;

  const row = await getOfficialSource(country, category);
  const block = formatOfficialSourceVerificationBlock(row);
  if (!block) return params.assistantAnswer;

  if (params.assistantAnswer.includes(block.trim())) return params.assistantAnswer;
  return `${params.assistantAnswer.trimEnd()}${block}`;
}
