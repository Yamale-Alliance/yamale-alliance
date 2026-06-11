import { getRequirementsRegion } from "@/lib/afcfta-country-requirements";
import { isMultiInstrumentListQuery } from "@/lib/ai-rag-context-budget";
import type { ResolvedLibrarySearchIntent } from "@/lib/ai-library-search-intent";
import { RE_COUNTRY_INVESTMENT_OVERVIEW } from "@/lib/ai-multilingual-search";

/** West African Economic and Monetary Union — investment / harmonised business rules layer. */
const UEMOA_COUNTRIES = new Set([
  "Benin",
  "Burkina Faso",
  "Côte d'Ivoire",
  "Guinea-Bissau",
  "Mali",
  "Niger",
  "Senegal",
  "Togo",
]);

/** East African Community member states. */
const EAC_COUNTRIES = new Set([
  "Burundi",
  "DR Congo",
  "Kenya",
  "Rwanda",
  "Somalia",
  "South Sudan",
  "Tanzania",
  "Uganda",
]);

/** COMESA member states (investment protocol / free movement). */
const COMESA_COUNTRIES = new Set([
  "Burundi",
  "Comoros",
  "DR Congo",
  "Djibouti",
  "Egypt",
  "Eritrea",
  "Eswatini",
  "Ethiopia",
  "Kenya",
  "Libya",
  "Madagascar",
  "Malawi",
  "Mauritius",
  "Rwanda",
  "Seychelles",
  "Somalia",
  "Sudan",
  "Tunisia",
  "Uganda",
  "Zambia",
  "Zimbabwe",
]);

/** CEMAC member states. */
const CEMAC_COUNTRIES = new Set([
  "Cameroon",
  "Central African Republic",
  "Chad",
  "Congo Republic",
  "Equatorial Guinea",
  "Gabon",
]);

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

/**
 * Broad country investment overview: "invest in Guinea", "all laws for investing",
 * Liberia + BITs + investment code + tips, etc.
 */
export function detectCountryInvestmentOverviewQuery(
  raw: string,
  countryName: string | null | undefined
): boolean {
  if (!countryName?.trim()) return false;
  const q = raw.trim().toLowerCase();
  if (q.length < 10) return false;

  if (RE_COUNTRY_INVESTMENT_OVERVIEW.test(q)) return true;

  const investmentCue =
    /\b(invest(ing|ment|ments|or|isseurs?)|foreign\s+direct|fdi|bit|bits|bilateral\s+investment|investment\s+code|investment\s+law)\b/i.test(
      q
    );
  const overviewCue =
    isMultiInstrumentListQuery(raw) ||
    /\b(all|every|laws?|requirements?|tips?|information|overview|guide|what\s+(do\s+i\s+need|are\s+the\s+rules)|legal\s+framework|need\s+to\s+know)\b/i.test(
      q
    );

  return investmentCue && overviewCue;
}

/** Regional / continental framework ids to hydrate when user asks for investment law in a member state. */
export function inferInvestmentRegionalFrameworkIds(countryName: string): string[] {
  const ids: string[] = ["afcfta"];
  const region = getRequirementsRegion(countryName);

  if (region === "ECOWAS") ids.push("ecowas");
  if (region === "SADC") ids.push("sadc");
  if (UEMOA_COUNTRIES.has(countryName)) ids.push("uemoa_waemu");
  if (EAC_COUNTRIES.has(countryName)) ids.push("eac");
  if (COMESA_COUNTRIES.has(countryName)) ids.push("comesa");
  if (CEMAC_COUNTRIES.has(countryName)) ids.push("cemac");

  return Array.from(new Set(ids));
}

export type SupranationalFrameworkRef = {
  id: string;
  canonicalName: string;
  description: string;
  titleSearchTerms: string[];
};

export function mergeSupranationalFrameworksForCountryInvestment(
  query: string,
  countryName: string | null | undefined,
  explicitMatches: SupranationalFrameworkRef[],
  allFrameworks: SupranationalFrameworkRef[]
): SupranationalFrameworkRef[] {
  if (!countryName?.trim() || !detectCountryInvestmentOverviewQuery(query, countryName)) {
    return explicitMatches;
  }
  const inferredIds = inferInvestmentRegionalFrameworkIds(countryName);
  const seen = new Set(explicitMatches.map((f) => f.id));
  const inferred = allFrameworks.filter((f) => inferredIds.includes(f.id) && !seen.has(f.id));
  return [...explicitMatches, ...inferred];
}

/** Force investment domestic + treaty intents and lexicon when user wants a full investment picture for one country. */
export function enrichResolvedIntentForCountryInvestment(
  resolvedIntent: ResolvedLibrarySearchIntent,
  query: string,
  countryName?: string | null
): ResolvedLibrarySearchIntent {
  if (!countryName?.trim() || !detectCountryInvestmentOverviewQuery(query, countryName)) {
    return resolvedIntent;
  }

  const matchedIds = Array.from(
    new Set([...resolvedIntent.matchedIds, "investment_domestic", "investment_treaty"])
  );

  return {
    ...resolvedIntent,
    primaryId: resolvedIntent.primaryId === "generic" ? "investment_domestic" : resolvedIntent.primaryId,
    matchedIds,
    shouldDemoteInvestmentTreatyNoise: false,
    mergedLexiconExtra: dedupeLower([
      ...resolvedIntent.mergedLexiconExtra,
      "investment",
      "investissement",
      "bilateral",
      "treaty",
      "treaties",
      "bit",
      "bits",
      "agreement",
      "ecowas",
      "investment code",
      "foreign investment",
      "promotion",
      "protection",
    ]).slice(0, 28),
  };
}
