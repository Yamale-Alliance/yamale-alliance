import { RE_INVESTMENT_TREATY } from "@/lib/ai-multilingual-search";
import { titleLooksLikeCrossBorderTreatyTitle } from "@/lib/ai-treaty-catalog-retrieval";

const INVESTMENT_TREATY_TITLE =
  /\b(bilateral\s+investment|bits?\b|promotion\s+and\s+(reciprocal\s+)?protection\s+of\s+investments|encouragement\s+and\s+reciprocal\s+protection|reciprocal\s+promotion\s+and\s+protection)\b/i;

const INTERGOV_INVESTMENT_AGREEMENT = /\bagreement\s+between\s+the\s+government\b/i;

/** Regional trade/investment protocols that are not national labour or IP statutes. */
const REGIONAL_INVESTMENT_ANNEX =
  /\b(cooperation\s+on\s+investment|amending\s+annex\b[^.]{0,48}\binvestment\b|protocol\s+on\s+finance\s+and\s+investment)\b/i;

const NATIONAL_LAW_INTENTS_DEMOTE_BITS = new Set([
  "labor",
  "intellectual_property",
  "tax",
  "registration",
  "mining",
  "oil_gas",
  "data_protection",
  "banking_finance",
  "corruption",
  "telecommunications",
  "environment",
  "land",
  "criminal",
]);

/** Bilateral / regional investment treaty titles (not Paris/Berne/TRIPS-style IP law). */
export function isBilateralOrInvestmentTreatyTitle(title: string): boolean {
  const t = String(title ?? "").trim();
  if (t.length < 12) return false;
  const lower = t.toLowerCase();
  if (INVESTMENT_TREATY_TITLE.test(t)) return true;
  if (INTERGOV_INVESTMENT_AGREEMENT.test(t) && /\binvest(ment|ments)?\b/i.test(t)) return true;
  if (REGIONAL_INVESTMENT_ANNEX.test(t)) return true;
  if (titleLooksLikeCrossBorderTreatyTitle(t) && /\binvest(ment|ments)?\b/i.test(lower)) return true;
  return false;
}

export function userQueryAsksForInvestmentTreaties(query: string): boolean {
  const q = String(query ?? "").trim();
  if (!q) return false;
  return RE_INVESTMENT_TREATY.test(q);
}

export function shouldDemoteInvestmentTreatyNoise(
  primaryIntentId: string,
  userQuery?: string
): boolean {
  if (userQuery && userQueryAsksForInvestmentTreaties(userQuery)) return false;
  if (primaryIntentId === "investment_treaty") return false;
  return NATIONAL_LAW_INTENTS_DEMOTE_BITS.has(primaryIntentId);
}

export function isOffTopicInvestmentTreatyForNationalLawQuery(
  title: string,
  primaryIntentId: string,
  userQuery?: string
): boolean {
  if (!shouldDemoteInvestmentTreatyNoise(primaryIntentId, userQuery)) return false;
  return isBilateralOrInvestmentTreatyTitle(title);
}

/** Principal employment / labour relations statute (not workers' comp, pension, or BITs). */
export function isCoreLaborStatuteTitle(title: string): boolean {
  const t = String(title ?? "").toLowerCase();
  return /\b(basic\s+conditions\s+of\s+employment|industrial\s+(and\s+)?labou?r\s+relations|labou?r\s+relations\s+act|employment\s+code(\s+act)?|employment\s+act|labou?r\s+code|labor\s+code|code\s+du\s+travail|minimum\s+wage\s+act|national\s+minimum\s+wage)\b/i.test(
    t
  );
}
