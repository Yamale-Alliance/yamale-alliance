import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeIlikePattern } from "@/lib/law-country-scope";
import { LAW_HAS_BODY_OR_FILTER, filterLawsWithReadableBody } from "@/lib/law-readable-body";
import {
  type PreferredDocumentLanguage,
  filterLawsByPreferredDocumentLanguage,
  lawDocumentLanguageScore,
} from "@/lib/law-language-preference";
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
  const deduped = dedupeOhadaUniformActsByInstrumentKey(
    laws.filter((law) => isOhadaInstrument(law)),
    preferredLanguage
  );
  return filterLawsByPreferredDocumentLanguage(deduped, preferredLanguage ?? null, { strict: true });
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
