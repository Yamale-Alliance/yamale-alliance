/**
 * RAG helpers for OHADA Uniform Act on Commercial Companies (AUSCGIE) and related company forms.
 */

import { normalizeQueryForLibrarySearch } from "@/lib/ai-multilingual-search";
import { escapeIlikePattern } from "@/lib/law-country-scope";
import { LAW_HAS_BODY_OR_FILTER, filterLawsWithReadableBody } from "@/lib/law-readable-body";

const LAWS_AI_SELECT =
  "id, title, content, content_plain, year, status, metadata, source_name, country_id, applies_to_all_countries, category_id, countries(name), categories!laws_category_id_fkey(name)";

function isOhadaGeneralCommercialLawTitle(title: string): boolean {
  return /(droit\s+commercial\s+g[eé]n[eé]ral|general\s+commercial\s+law|\baudcg\b)/i.test(title);
}

/** User asks about OHADA company law (SARL/SA/SAS, LP/SCS, joint venture, AUSCGIE, etc.). */
export function isOhadaCommercialCompaniesQuery(query: string): boolean {
  const q = normalizeQueryForLibrarySearch(query).toLowerCase();

  const frenchCorporateGovernance =
    /\b(associ[eé]\s+minoritaire|associ[eé]s?\s+minoritaires|augmentation\s+de\s+capital|droit\s+pr[eé]f[eé]rentiel|droit\s+de\s+(retrait|rachat)|quorum|majorit[eé]\s+requis|parts\s+sociales|g[eé]rance)\b/.test(
      q
    );
  const companyForm =
    /\b(sarl|sas|\bs\.?a\.?\b|soci[eé]t[eé]\s+anonyme|soci[eé]t[eé]\s+[aà]\s+responsabilit[eé]\s+limit[eé]e|capital\s+social|company\s+formation|constitution\s+de\s+soci[eé]t[eé])\b/.test(
      q
    );

  if (companyForm && frenchCorporateGovernance) return true;

  const acteUniformeCompanies =
    /\b(acte\s+uniforme|uniform\s+act)\b/.test(q) &&
    /\b(soci[eé]t[eé]s?\s+commerciales?|droit\s+des\s+soci[eé]t[eé]s|commercial\s+compan)/.test(q);
  if (acteUniformeCompanies) return true;

  if (!/\bohada\b/.test(q)) return false;

  if (
    /\b(commercial\s+compan|soci[eé]t[eé]s?\s+commerciales?|droit\s+des\s+soci[eé]t[eé]s|acte\s+uniforme.*soci[eé]t[eé]|uniform\s+act.*commercial\s+compan|\bausc\b|\bauscgie\b|groupement\s+d['']?int[eé]r[eê]t\s+[eé]conomique|economic\s+interest\s+group)\b/.test(
      q
    )
  ) {
    return true;
  }

  if (frenchCorporateGovernance) return true;

  if (companyForm) return true;

  if (
    /\b(limited\s+partnership|\blp\b|scs|soci[eé]t[eé]\s+en\s+commandite|commandit|commanditaires?|associ[eé]s?\s+commandit)\b/.test(
      q
    ) &&
    /\b(compan|soci[eé]t[eé]|corporate|partnership|partner|liability|structure|formation|venture|investor)\b/.test(
      q
    )
  ) {
    return true;
  }

  if (/\bjoint\s+venture\b/.test(q) && /\b(structur|compan|soci[eé]t[eé]|corporate|liability|ohada)\b/.test(q)) {
    return true;
  }

  return false;
}

export function isOhadaInstrument(law: {
  title?: string | null;
  source_name?: string | null;
}): boolean {
  const title = String(law?.title ?? "").toLowerCase();
  const sourceName = String(law?.source_name ?? "").toLowerCase();
  return /\bohada\b|organisation for the harmonization of business law in africa|acte uniforme|uniform act/i.test(
    `${title}\n${sourceName}`
  );
}

/** Other OHADA uniform acts that often rank on keyword "ohada" but are not the companies act. */
export function isOffTopicForOhadaCommercialCompanies(law: {
  title?: string | null;
  categories?: { name?: string | null } | null;
}): boolean {
  const title = String(law?.title ?? "").toLowerCase();
  const category = String(law?.categories?.name ?? "").toLowerCase();
  const blob = `${title}\n${category}`;

  if (/\bau\s+sommaire\b/.test(blob)) return true;
  if (/(soci[eé]t[eé]s?\s+coop[eé]ratives?|cooperatives?)/i.test(blob)) return true;
  if (/(proc[eé]dures?\s+collectives?|apurement\s+du\s+passif|insolvency|bankruptcy|liquidation)/i.test(blob))
    return true;
  if (/(m[eé]diation|mediation|arbitrage|arbitration)\b/i.test(blob) && !/soci[eé]t[eé]s?\s+commerciales?/i.test(title))
    return true;

  if (
    /(comptab|accounting|syscohada|audit|organisation\s+des\s+audits|transparence\s+des\s+comptes|financial\s+reporting)/i.test(
      blob
    ) &&
    !/soci[eé]t[eé]s?\s+commerciales?|commercial companies/i.test(title)
  ) {
    return true;
  }
  if (/(transport|carriage\s+of\s+goods|droit\s+des\s+transports)/i.test(blob)) return true;
  if (/(securities|valeurs\s+mobili|simplified\s+recovery|recouvrement\s+des\s+cr[eé]ances)/i.test(blob)) return true;
  if (/(organisation\s+and\s+harmonization|corporate\s+governance\s+and\s+accounting)/i.test(blob)) return true;
  if (isOhadaGeneralCommercialLawTitle(title)) return true;

  return false;
}

export function isLikelyOhadaCommercialCompaniesLaw(law: {
  title?: string | null;
  categories?: { name?: string | null } | null;
}): boolean {
  const title = String(law?.title ?? "").toLowerCase();
  const category = String(law?.categories?.name ?? "").toLowerCase();

  const titleSignals =
    /(soci[eé]t[eé]s?\s+commerciales?|commercial companies|groupement d'?int[eé]r[eê]t [ée]conomique|economic interest groups|droit des soci[eé]t[eé]s?\s+commerciales?|company law)/i;
  const partnershipSignals =
    /(soci[eé]t[eé]\s+en\s+commandite|commandite\s+simple|limited\s+partnership)/i;

  const offTopicSignals =
    /(droit du travail|labou?r|m[eé]diation|mediation|arbitrage|arbitration|dispute|proc[eé]dures?\s+collectives?|apurement\s+du\s+passif|coop[eé]ratives?|comptab|syscohada|accounting|transport|securities|recouvrement)/i;

  if (isOhadaGeneralCommercialLawTitle(title)) return false;

  const categoryLooksCorporate = /corporate|company/.test(category);
  return (titleSignals.test(title) || partnershipSignals.test(title) || categoryLooksCorporate) && !offTopicSignals.test(title);
}

const OHADA_CC_TITLE_TERMS = [
  "sociétés commerciales",
  "societes commerciales",
  "commercial companies",
  "economic interest groups",
  "groupement d'intérêt économique",
  "acte uniforme relatif au droit des sociétés",
  "uniform act relating to commercial companies",
  "uniform act on commercial companies",
  "droit des sociétés commerciales",
  "commandite",
];

/** Fetch AUSCGIE / OHADA commercial companies instrument(s) into the candidate pool (global OHADA scope). */
export async function fetchOhadaCommercialCompaniesInstrumentLaws(
  supabase: { from: (table: string) => unknown },
  opts?: { excludeIds?: Set<string>; maxLaws?: number }
): Promise<unknown[]> {
  const maxLaws = opts?.maxLaws ?? 6;
  const excludeIds = opts?.excludeIds;
  const collected = new Map<string, unknown>();

  for (const term of OHADA_CC_TITLE_TERMS) {
    if (collected.size >= maxLaws) break;
    const esc = escapeIlikePattern(term);
    const { data, error } = await (supabase as { from: (t: string) => any })
      .from("laws")
      .select(LAWS_AI_SELECT)
      .or(LAW_HAS_BODY_OR_FILTER)
      .neq("status", "Repealed")
      .ilike("title", `%${esc}%`)
      .limit(12);
    if (error) continue;
    for (const row of filterLawsWithReadableBody((data ?? []) as Record<string, unknown>[])) {
      if (!isOhadaInstrument(row as { title?: string; source_name?: string })) continue;
      if (isOffTopicForOhadaCommercialCompanies(row as { title?: string; categories?: { name?: string } })) continue;
      const id = String((row as { id?: string }).id ?? "");
      if (!id || excludeIds?.has(id)) continue;
      const rowTitle = String((row as { title?: string }).title ?? "");
      if (
        !isLikelyOhadaCommercialCompaniesLaw(row as { title?: string; categories?: { name?: string } }) &&
        !/commercial compan|soci[eé]t[eé]s?\s+commerciales?/i.test(rowTitle)
      ) {
        continue;
      }
      if (!collected.has(id)) collected.set(id, row);
      if (collected.size >= maxLaws) break;
    }
  }

  return [...collected.values()];
}

export function buildOhadaCommercialCompaniesExcerptAnchors(query: string): string[] {
  const q = normalizeQueryForLibrarySearch(query).toLowerCase();
  const anchors: string[] = [
    "acte uniforme",
    "sociétés commerciales",
    "societes commerciales",
    "commercial companies",
    "formation",
    "constitution de la société",
  ];
  if (/\bcommandit|limited\s+partnership|\blp\b|scs\b/.test(q)) {
    anchors.push(
      "société en commandite",
      "societe en commandite",
      "commandité",
      "commandite",
      "commanditaire",
      "associé commandité",
      "associé commanditaire",
      "responsabilité limitée",
      "actes de gestion"
    );
  }
  if (/\bsarl\b|responsabilit[eé]\s+limit[eé]e/.test(q)) {
    anchors.push("société à responsabilité limitée", "capital social", "parts sociales", "gérance");
  }
  if (
    /\b(associ[eé]\s+minoritaire|augmentation\s+de\s+capital|droit\s+pr[eé]f[eé]rentiel|droit\s+de\s+retrait|quorum|majorit[eé])\b/.test(
      q
    )
  ) {
    anchors.push(
      "associé minoritaire",
      "augmentation du capital",
      "augmentation de capital",
      "droit préférentiel de souscription",
      "droit de retrait",
      "quorum",
      "majorité",
      "parts sociales",
      "assemblée générale",
      "minority shareholder",
      "capital increase",
      "pre-emptive"
    );
  }
  if (/\bsas\b/.test(q)) {
    anchors.push("société par actions simplifiée", "statuts", "président");
  }
  if (/\bs\.?a\.?\b|soci[eé]t[eé]\s+anonyme/.test(q)) {
    anchors.push("société anonyme", "capital minimum", "conseil d'administration");
  }
  return anchors;
}
