import {
  isDomesticIpActTitle,
  isNationalIndustrialPropertyActTitle,
  isNationalTrademarksActTitle,
} from "@/lib/ai-ip-act-aliases";
import { lawMetadataIpActRole } from "@/lib/law-search-aliases";

export type DomesticIpActRole = "unified" | "patents" | "trademarks" | "amendment" | "other";

/** Countries where patent/trademark queries should resolve to a unified Industrial Property Act. */
export const UNIFIED_IP_COUNTRY_NAMES = new Set([
  "Botswana",
  "Gambia",
  "Mauritius",
  "Namibia",
  "Seychelles",
]);

export function isPatentFocusedIpQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (/\b(trademarks?\s+act|trade\s+marks?\s+act)\b/i.test(q)) return false;
  return (
    /\b(patents?\s+act|patent\s+law|patent\s+protection|brevet)\b/i.test(q) ||
    (/\bpatents?\b/i.test(q) && !/\btrademarks?\b/i.test(q))
  );
}

export function isTrademarkFocusedIpQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (/\bpatents?\s+act\b/i.test(q)) return false;
  return (
    /\b(trademarks?\s+act|trade\s+marks?\s+act|trademark\s+law|marques)\b/i.test(q) ||
    (/\btrademarks?\b/i.test(q) && !/\bpatents?\b/i.test(q))
  );
}

export function inferDomesticIpActRole(law: {
  title?: string | null;
  metadata?: unknown;
}): DomesticIpActRole {
  const fromMeta = lawMetadataIpActRole(law.metadata);
  if (fromMeta) return fromMeta;
  const title = String(law.title ?? "");
  if (/\bamendment\b/i.test(title) && isNationalIndustrialPropertyActTitle(title)) {
    return "amendment";
  }
  if (isNationalIndustrialPropertyActTitle(title)) return "unified";
  if (/\bpatents?\s+act\b/i.test(title)) return "patents";
  if (isNationalTrademarksActTitle(title)) return "trademarks";
  return "other";
}

function lawYear(law: { title?: string | null; year?: number | null }): number {
  if (typeof law.year === "number" && law.year > 1900) return law.year;
  const m = String(law.title ?? "").match(/\b(19|20)\d{2}\b/);
  return m ? Number.parseInt(m[0], 10) : 0;
}

function rolePriority(role: DomesticIpActRole, patentFocus: boolean, trademarkFocus: boolean): number {
  if (patentFocus) {
    if (role === "patents") return 0;
    if (role === "unified") return 1;
    if (role === "amendment") return 2;
    if (role === "trademarks") return 4;
    return 3;
  }
  if (trademarkFocus) {
    if (role === "trademarks") return 0;
    if (role === "unified") return 1;
    if (role === "amendment") return 2;
    if (role === "patents") return 4;
    return 3;
  }
  if (role === "unified") return 0;
  if (role === "amendment") return 1;
  if (role === "patents") return 2;
  if (role === "trademarks") return 2;
  return 3;
}

/**
 * Re-order retrieved domestic IP laws: correct act family first, newest year within each role.
 */
export function rankDomesticIpLawsForQuery<T extends { title?: string | null; year?: number | null; metadata?: unknown }>(
  laws: T[],
  query: string,
  countryName?: string | null
): T[] {
  const unifiedCountry = countryName ? UNIFIED_IP_COUNTRY_NAMES.has(countryName.trim()) : false;
  const patentFocus = isPatentFocusedIpQuery(query);
  const trademarkFocus = isTrademarkFocusedIpQuery(query);

  const domestic = laws.filter((law) => isDomesticIpActTitle(String(law.title ?? "")));
  if (domestic.length <= 1) return laws;

  const rest = laws.filter((law) => !domestic.includes(law));
  const sortedDomestic = [...domestic].sort((a, b) => {
    const roleA = inferDomesticIpActRole(a);
    const roleB = inferDomesticIpActRole(b);
    let priA = rolePriority(roleA, patentFocus, trademarkFocus);
    let priB = rolePriority(roleB, patentFocus, trademarkFocus);
    if (unifiedCountry) {
      if (roleA === "unified" || roleA === "amendment") priA -= 1;
      if (roleB === "unified" || roleB === "amendment") priB -= 1;
    }
    if (priA !== priB) return priA - priB;
    return lawYear(b) - lawYear(a);
  });

  return [...sortedDomestic, ...rest];
}

/** Extra title-search terms for unified-IP countries (from audit). */
export function unifiedCountryIpSearchTerms(countryName: string | null | undefined): string[] {
  if (!countryName || !UNIFIED_IP_COUNTRY_NAMES.has(countryName.trim())) return [];
  return [
    "industrial property act",
    "industrial property",
    "patents act",
    "patent act",
    "trademarks act",
    "trademark act",
    "trade marks act",
  ];
}
