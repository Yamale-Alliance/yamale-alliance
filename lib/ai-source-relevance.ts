/**
 * Gate which retrieved library instruments stay in the AI prompt and appear as user-facing sources.
 */

import {
  lawIsInScopeForCountryQuery,
  lawTitleContradictsCountryMetadata,
} from "@/lib/law-country-metadata-mismatch";

export type LawRelevanceFields = {
  title: string;
  category: string;
  content: string;
  country: string;
  retrievalScore?: number;
};

/** Tokens too generic to prove a document matches the user's question. */
const GENERIC_OVERLAP_STOP = new Set([
  "law",
  "laws",
  "act",
  "acts",
  "code",
  "legal",
  "legislation",
  "regulation",
  "regulations",
  "article",
  "articles",
  "section",
  "sections",
  "chapter",
  "country",
  "national",
  "federal",
  "state",
  "government",
  "public",
  "general",
  "specific",
  "related",
  "provide",
  "main",
  "principal",
  "principals",
  "rules",
  "rule",
  "right",
  "rights",
  "under",
  "about",
  "what",
  "does",
  "have",
  "applies",
  "apply",
  "african",
  "africa",
]);

function normalizeCountryLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function countryLabelsEquivalentForSources(a: string, b: string): boolean {
  const na = normalizeCountryLabel(a);
  const nb = normalizeCountryLabel(b);
  if (na === nb) return true;
  const ivoirian = new Set(["cotedivoire", "ivorycoast"]);
  if (ivoirian.has(na) && ivoirian.has(nb)) return true;
  const caboVerde = new Set(["caboverde", "capeverde"]);
  if (caboVerde.has(na) && caboVerde.has(nb)) return true;
  const congoRepublic = new Set(["congo", "congorepublic", "republicofthecongo"]);
  if (congoRepublic.has(na) && congoRepublic.has(nb)) return true;
  return false;
}

export function substantiveOverlapTokens(overlapTokens: string[]): string[] {
  return overlapTokens.filter((t) => {
    const x = t.trim().toLowerCase();
    if (!x) return false;
    if (x === "ip") return true;
    return x.length >= 4 && !GENERIC_OVERLAP_STOP.has(x);
  });
}

function countHits(blob: string, tokens: string[]): number {
  let n = 0;
  for (const t of tokens) {
    if (!t) continue;
    if (t.includes(" ")) {
      if (blob.includes(t)) n++;
    } else if (t === "ip") {
      if (/\bip\b/i.test(blob)) n++;
    } else if (t.length >= 3 && blob.includes(t)) {
      n++;
    }
  }
  return n;
}

function lawCountryInScope(
  country: string,
  title: string,
  effectiveCountry: string | null | undefined,
  enforceCountryScope: boolean
): boolean {
  if (!enforceCountryScope || !effectiveCountry?.trim()) return true;
  const c = (country || "").trim();
  if (!c || c === "All countries" || c === "Multiple countries") return true;
  if (/\b(ohada|afcfta|afcta|ecowas|cedeao|eac|comesa|sadc|cemac|uemoa|waemu|au\b|african union|berne|trips|wipo|oapi|aripo)\b/i.test(title)) {
    return true;
  }
  return countryLabelsEquivalentForSources(c, effectiveCountry);
}

export type LawRelevanceGateOptions = {
  law: LawRelevanceFields;
  overlapTokens: string[];
  primaryIntentId: string;
  /** Model cited this slot or title appears in the answer */
  usedInAnswer: boolean;
  /** Caller already ruled the row off-topic for the primary intent */
  isOffTopic: boolean;
  effectiveCountry?: string | null;
  /** When true, drop national laws from other countries (mirrors country-lock on prompt docs) */
  enforceCountryScope?: boolean;
};

/**
 * Whether an instrument should appear as a source card (or stay in the attached prompt set).
 */
export function isLawRelevantForAiSources(opts: LawRelevanceGateOptions): boolean {
  const { law, overlapTokens, usedInAnswer, isOffTopic, effectiveCountry, enforceCountryScope } = opts;

  if (isOffTopic) return false;

  const scopeEnforced = Boolean(enforceCountryScope && effectiveCountry?.trim());
  if (scopeEnforced) {
    if (!lawCountryInScope(law.country, law.title, effectiveCountry, true)) return false;
    if (lawTitleContradictsCountryMetadata(law.title, effectiveCountry!)) return false;
    if (!lawIsInScopeForCountryQuery(law.title, law.country, effectiveCountry!)) return false;
  }

  if (usedInAnswer) return true;

  const substantive = substantiveOverlapTokens(overlapTokens);
  const titleBlob = law.title.toLowerCase();
  const metaBlob = `${law.title}\n${law.category}`.toLowerCase();
  const fullBlob = `${metaBlob}\n${law.content}`.toLowerCase();

  const titleHits = countHits(titleBlob, substantive);
  const metaHits = countHits(metaBlob, substantive);
  const bodyHits = countHits(fullBlob, substantive);
  const rs = typeof law.retrievalScore === "number" ? law.retrievalScore : 0;

  if (titleHits >= 2) return true;
  if (titleHits >= 1 && (bodyHits >= 2 || metaHits >= 2)) return true;
  if (titleHits >= 1 && rs >= 22) return true;
  if (bodyHits >= 3 && rs >= 18) return true;

  // High retrieval rank with at least one substantive hit in title or category
  if (rs >= 32 && metaHits >= 1) return true;

  return false;
}

export function filterLegalContextByRelevance<T extends LawRelevanceFields>(
  laws: T[],
  opts: Omit<LawRelevanceGateOptions, "law" | "usedInAnswer" | "isOffTopic"> & {
    isOffTopic: (law: T) => boolean;
  }
): T[] {
  return laws.filter((law) =>
    isLawRelevantForAiSources({
      law,
      overlapTokens: opts.overlapTokens,
      primaryIntentId: opts.primaryIntentId,
      usedInAnswer: false,
      isOffTopic: opts.isOffTopic(law),
      effectiveCountry: opts.effectiveCountry,
      enforceCountryScope: opts.enforceCountryScope,
    })
  );
}
