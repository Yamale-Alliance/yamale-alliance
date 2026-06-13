import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeIlikePattern } from "@/lib/law-country-scope";
import { LAW_HAS_BODY_OR_FILTER, filterLawsWithReadableBody } from "@/lib/law-readable-body";
import { type PreferredDocumentLanguage, lawDocumentLanguageScore } from "@/lib/law-language-preference";
import { applyLawRagApprovalFilter } from "@/lib/law-rag-approval";
import { isOhadaInstrument } from "@/lib/ohada-commercial-companies-retrieval";

/** Room for all OHADA uniform acts (currently 11+) in list-style answers. */
export const OHADA_UNIFORM_ACT_CATALOG_MAX_DOCS = 16;

const OHADA_TITLE_SEARCH_TERMS = [
  "ohada",
  "acte uniforme",
  "uniform act",
  "acte uniforme relatif",
  "uniform act relating",
  "uniform act on",
  "acte uniforme portant",
];

/**
 * User asks to list / enumerate OHADA uniform acts (EN or FR).
 * e.g. "What are the OHADA laws?", "Liste des actes uniformes OHADA"
 */
export function detectOhadaUniformActInventoryQuery(raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!/\bohada\b/.test(q)) return false;

  const inventory =
    /\b(all|every|each|list|show|what are|which|how many|name|enumerate|overview|catalogue|catalog|quels|quelles)\b/.test(q) ||
    /\b(les\s+actes|actes\s+uniformes|uniform\s+acts?)\b/.test(q);
  const instrument =
    /\b(laws?|acts?|actes|instruments?|uniform\s+acts?|actes\s+uniformes|textes?)\b/.test(q);

  return inventory && instrument;
}

/** Canonical bucket for EN/FR (and duplicate country) rows of the same OHADA uniform act. */
export function normalizeOhadaUniformActKey(title: string): string {
  const t = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/m[eé]diat|conciliation/.test(t)) return "mediation";
  if (/arbitr/.test(t)) return "arbitration";
  if (/soci[eé]t[eé]s?\s+commerciales|commercial companies|groupement d.?int[eé]r[eê]t/.test(t)) {
    return "commercial_companies";
  }
  if (
    /proc[eé]dures?\s+collectives|collective proceedings|clearing debts|insolvency|apurement du passif|bankruptcy/.test(
      t
    )
  ) {
    return "insolvency";
  }
  if (/but non lucratif|non.?profit|nonprofit/.test(t)) return "accounting_nonprofit";
  if (/syscohada|harmonization of corporate accounting|organisation.*comptable|comptabilit[eé] des entit[eé]s/.test(t)) {
    return "accounting_syscohada";
  }
  if (/comptab|accounting|audits?|transparence des comptes/.test(t)) return "accounting_syscohada";
  if (/coop[eé]ratives|cooperatives/.test(t)) return "cooperatives";
  if (/simplified recovery|recouvrement|voies d.ex[eé]cution|enforcement measures/.test(t)) {
    return "simplified_recovery";
  }
  if (/security interests|s[uû]ret[eé]s|suretes|valeurs\s+mobili/.test(t)) return "security_interests";
  if (/transport|carriage of goods|droit des transports|transport de marchandises/.test(t)) return "transport";
  if (
    /droit commercial g[eé]n[eé]ral|general commercial law|uniform act on commercial law|acte uniforme portant sur le droit commercial/.test(
      t
    )
  ) {
    return "general_commercial_law";
  }
  if (/organisation.*harmonization|organization.*harmonization|corporate governance/.test(t)) {
    return "organization_harmonization";
  }

  return t
    .replace(/\b(ohada|acte uniforme|uniform act|relatif au|relating to|relatif a|relating|on the|on|au|des|de|du|the|and|et|portant)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72);
}

function normalizeOhadaMatchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Title tokens that appear in almost every OHADA uniform act — too weak for OR search. */
const OHADA_TITLE_BOILERPLATE = new Set([
  "ohada",
  "acte",
  "uniforme",
  "uniform",
  "act",
  "acts",
  "actes",
  "portant",
  "relatif",
  "relating",
  "on",
  "the",
  "au",
  "a",
  "des",
  "de",
  "du",
  "le",
  "la",
  "les",
  "et",
  "and",
  "or",
  "sur",
  "droit",
  "law",
]);

/** Bilingual title phrase groups for strict library search (each inner array is OR; outer arrays are AND). */
const OHADA_BUCKET_TITLE_FILTERS: Record<string, readonly (readonly string[])[]> = {
  commercial_companies: [
    ["sociétés commerciales", "societes commerciales", "commercial companies"],
    ["acte uniforme", "uniform act"],
  ],
  insolvency: [
    ["procédures collectives", "procedures collectives", "collective proceedings"],
    ["apurement du passif", "clearing debts", "insolvency"],
  ],
  mediation: [["médiation", "mediation", "conciliation"]],
  arbitration: [["arbitrage", "arbitration"]],
  general_commercial_law: [
    ["droit commercial général", "droit commercial general", "general commercial law"],
  ],
  cooperatives: [["coopératives", "cooperatives"]],
  simplified_recovery: [
    ["recouvrement", "simplified recovery", "voies d exécution", "enforcement measures"],
  ],
  security_interests: [["sûretés", "suretes", "security interests", "valeurs mobili"]],
  transport: [["transport de marchandises", "carriage of goods", "droit des transports"]],
  accounting_syscohada: [["syscohada", "comptabilité", "accounting", "harmonization of corporate accounting"]],
  accounting_nonprofit: [["but non lucratif", "non-profit", "nonprofit"]],
  organization_harmonization: [
    ["organisation et harmonisation", "organization and harmonization", "corporate governance"],
  ],
};

export type OhadaUniformActTitleFilter = {
  bucketKey: string;
  /** Each group matches if any phrase hits the title (AND across groups). */
  titlePhraseGroups: readonly (readonly string[])[];
};

/** User pasted or typed a specific OHADA uniform act title (FR or EN), not a broad "list OHADA laws" query. */
export function isOhadaUniformActTitleQuery(freeText: string, tokens: string[]): boolean {
  const norm = normalizeOhadaMatchText(freeText);
  const hasUniformAct = /\b(acte\s+uniforme|uniform\s+act|actes\s+uniformes|uniform\s+acts)\b/.test(norm);
  const hasOhada = /\bohada\b/.test(norm);
  if (!hasUniformAct && !hasOhada) return false;
  if (detectOhadaUniformActInventoryQuery(freeText)) return false;
  const distinctive = ohadaUniformActDistinctiveTitleTokens(tokens, freeText);
  if (hasUniformAct && distinctive.length >= 1) return true;
  return hasOhada && distinctive.length >= 2;
}

/** Distinctive title tokens for AND matching (excludes OHADA boilerplate). */
export function ohadaUniformActDistinctiveTitleTokens(tokens: string[], freeText: string): string[] {
  const distinctive = tokens.filter((t) => {
    const x = t.trim().toLowerCase();
    return x.length >= 3 && !OHADA_TITLE_BOILERPLATE.has(x);
  });
  if (distinctive.length >= 2) return distinctive.slice(0, 8);
  const norm = normalizeOhadaMatchText(freeText);
  const fallback: string[] = [];
  for (const word of norm.split(/\s+/)) {
    if (word.length >= 4 && !OHADA_TITLE_BOILERPLATE.has(word)) fallback.push(word);
  }
  return [...new Set(fallback)].slice(0, 8);
}

/** True when two titles refer to the same OHADA uniform act (handles EN/FR naming differences). */
export function ohadaUniformActTitlesMatch(title: string, queryPhrase: string): boolean {
  const titleKey = normalizeOhadaUniformActKey(title);
  const queryKey = normalizeOhadaUniformActKey(queryPhrase);
  if (!titleKey || !queryKey) return false;
  if (titleKey === queryKey) return true;
  if (titleKey.length >= 8 && queryKey.length >= 8) {
    return titleKey.includes(queryKey) || queryKey.includes(titleKey);
  }
  return false;
}

/** Resolve bilingual PostgREST title filters for a pasted OHADA uniform act title. */
export function resolveOhadaUniformActTitleFilter(query: string): OhadaUniformActTitleFilter | null {
  const bucketKey = normalizeOhadaUniformActKey(query);
  const groups = OHADA_BUCKET_TITLE_FILTERS[bucketKey];
  if (groups?.length) {
    return { bucketKey, titlePhraseGroups: groups };
  }
  const distinctive = ohadaUniformActDistinctiveTitleTokens(
    normalizeOhadaMatchText(query).split(/\s+/).filter((t) => t.length >= 2),
    query
  );
  if (distinctive.length >= 2) {
    return {
      bucketKey,
      titlePhraseGroups: [distinctive.map((t) => t)],
    };
  }
  return null;
}

/** English/French search tokens to merge into AI retrieval for OHADA uniform act titles. */
export function ohadaUniformActRetrievalAliases(query: string): string[] {
  const bucketKey = normalizeOhadaUniformActKey(query);
  const filter = OHADA_BUCKET_TITLE_FILTERS[bucketKey];
  if (!filter) return [];
  const out = new Set<string>();
  for (const group of filter) {
    for (const phrase of group) {
      for (const token of normalizeOhadaMatchText(phrase).split(/\s+/)) {
        if (token.length >= 4) out.add(token);
      }
    }
  }
  return [...out].slice(0, 16);
}

export function pickPreferredOhadaUniformActRow<T extends { title?: string | null; language_code?: string | null }>(
  group: T[],
  preferredLanguage?: PreferredDocumentLanguage | null
): T {
  if (group.length <= 1) return group[0]!;
  const score = (law: T) => {
    let s = 0;
    if (preferredLanguage) s += lawDocumentLanguageScore(law, preferredLanguage);
    const title = String(law.title ?? "");
    if (/\bau\s+sommaire\b/i.test(title)) s -= 200;
    if (title.length > 20) s += 5;
    return s;
  };
  return [...group].sort((a, b) => score(b) - score(a))[0]!;
}

/** Collapse EN/FR/country duplicates of the same OHADA uniform act. */
export function dedupeOhadaUniformActsByInstrumentKey<
  T extends { title?: string | null; language_code?: string | null },
>(laws: T[], preferredLanguage?: PreferredDocumentLanguage | null): T[] {
  const buckets = new Map<string, T[]>();
  const passthrough: T[] = [];

  for (const law of laws) {
    if (!isOhadaInstrument(law)) {
      passthrough.push(law);
      continue;
    }
    const key = normalizeOhadaUniformActKey(String(law.title ?? ""));
    if (!key) {
      passthrough.push(law);
      continue;
    }
    buckets.set(key, [...(buckets.get(key) ?? []), law]);
  }

  const out: T[] = [...passthrough];
  for (const group of buckets.values()) {
    out.push(pickPreferredOhadaUniformActRow(group, preferredLanguage));
  }
  return out;
}

export function finalizeOhadaUniformActCatalog<T extends { title?: string | null; language_code?: string | null }>(
  laws: T[],
  preferredLanguage?: PreferredDocumentLanguage | null
): T[] {
  return dedupeOhadaUniformActsByInstrumentKey(
    laws.filter((law) => isOhadaInstrument(law)),
    preferredLanguage
  );
}

export async function fetchOhadaUniformActCatalogCandidates(
  supabase: SupabaseClient,
  lawsAiSelect: string,
  preferredLanguage?: PreferredDocumentLanguage | null
): Promise<unknown[]> {
  const db = supabase as any;
  const orParts = OHADA_TITLE_SEARCH_TERMS.map(
    (term) => `title.ilike.%${escapeIlikePattern(term)}%`
  );
  orParts.push(`source_name.ilike.%${escapeIlikePattern("ohada")}%`);

  const { data, error } = await applyLawRagApprovalFilter(
    db
      .from("laws")
      .select(lawsAiSelect)
      .or(LAW_HAS_BODY_OR_FILTER)
      .neq("status", "Repealed")
      .or(orParts.join(","))
  ).limit(400);

  if (error) {
    console.error("[AI RAG] OHADA uniform act catalog fetch:", error.message ?? error);
    return [];
  }

  const readable = filterLawsWithReadableBody((data ?? []) as Record<string, unknown>[]).filter((row) =>
    isOhadaInstrument(row as { title?: string; source_name?: string })
  ) as Array<{ title?: string | null; language_code?: string | null }>;

  return finalizeOhadaUniformActCatalog(readable, preferredLanguage).slice(0, 36);
}

export function ohadaUniformActRankingLexicon(): string[] {
  return [
    "ohada",
    "acte",
    "uniforme",
    "uniform",
    "act",
    "mediation",
    "médiation",
    "arbitration",
    "arbitrage",
    "commercial",
    "companies",
    "sociétés",
    "insolvency",
    "comptabilité",
    "syscohada",
  ];
}
