import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeSearchQueryForAi } from "@/lib/ai-library-search-intent";
import { englishLibraryTokensFromFrenchQuery } from "@/lib/ai-query-language-parity";
import { escapeIlikePattern } from "@/lib/law-country-scope";
import { applyCountryScopedTitleSearch } from "@/lib/law-country-scope-query";
import { applyLawRagApprovalFilter } from "@/lib/law-rag-approval";
import { LAW_HAS_BODY_OR_FILTER } from "@/lib/law-readable-body";
import {
  hintLooksLikeTrademarksAct,
  trademarkActTitleSearchPhrases,
} from "@/lib/ai-ip-act-aliases";
import { excludeInternalCategoryFromLawsQuery } from "@/lib/internal-library-categories";

const FORMAL_CITATION_PATTERN =
  /\b(loi\s+n[°ºo.]?\s*[\d\-–—/]+|act\s+no\.?\s*\d+|decree(?:t)?(?:\s+no\.?)?\s*[\d\-–—/]+|proclamation(?:\s+no\.?)?\s*[\d\-–—/]+|cap\.?\s*\d+|chapter\s+\d+|decreto-lei\s+n[°ºo.]?\s*[\d/]+|ohada\s+acte\s+uniforme)/i;

function extractNamedLawLineFromQuery(query: string): string | null {
  const lines = query
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    const lawLine = lines.find((line) => looksLikeNamedLawTitle(line));
    if (lawLine) return lawLine;
  }

  const summarizeMatch = query.match(
    /(?:summarize|summary|summarise|revise|revision|review|explain|describe|detail(?:ed)?)[\s\S]{0,140}?((?:A\s+)?(?:Proclamation|Act|Code|Decree|Law|Regulation|Ordinance|Statute)[\s\S]{10,280}?)/i
  );
  if (summarizeMatch?.[1]?.trim() && looksLikeNamedLawTitle(summarizeMatch[1])) {
    return summarizeMatch[1].trim();
  }

  const proclamationTitle = query.match(
    /\b(A\s+Proclamation[\s\S]{10,220}?\(Proclamation\s+[\d\-–—/]+\))/i
  );
  if (proclamationTitle?.[1]?.trim() && looksLikeNamedLawTitle(proclamationTitle[1])) {
    return proclamationTitle[1].trim();
  }

  return null;
}

function looksLikeNamedLawTitle(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  const genericCategoryLawPattern =
    /\b(corporate|tax|labou?r|employment|trade|customs|privacy|data protection|intellectual property|environmental|criminal|civil)\s+laws?\b/i;
  if (genericCategoryLawPattern.test(normalized)) return false;
  if (/\blaws?\s+in\s+[a-z]/i.test(normalized)) return false;
  if (/\blaws?\s+of\s+[a-z]/i.test(normalized)) return false;

  if (/\b(act|code|regulation|regulations|decree|ordinance|order|proclamation|constitution|bill)\b/i.test(value)) {
    return true;
  }
  if (
    /\b(loi|code|decret|décret|arrete|arrêté|ordonnance|reglement|règlement|acte\s+uniforme)\b/i.test(value)
  ) {
    return true;
  }
  if (/\b(trademarks?|trade\s+marks?)\s+act\b/i.test(value)) return true;
  if (/\b(code\s+du\s+travail|code\s+fiscal|code\s+p[eé]nal|code\s+des\s+investissements)\b/i.test(value)) {
    return true;
  }
  if (/\bcap\.?\s*\d+\b/i.test(value) && /\bact\b/i.test(value)) return true;
  return false;
}

/** Slash-style instrument numbers such as 608/2010 (Ethiopian proclamations, etc.). */
export function extractSlashCitationFromHint(hint: string): string | null {
  const paren = hint.match(/\((?:Proclamation|Decree|Act|Law|Regulation)\s+(\d+)\s*\/\s*(\d+)\)/i);
  if (paren?.[1] && paren?.[2]) return `${paren[1]}/${paren[2]}`;

  const inline = hint.match(/\b(?:proclamation|decree|act|law|regulation)\s+(?:no\.?\s*)?(\d+)\s*\/\s*(\d+)\b/i);
  if (inline?.[1] && inline?.[2]) return `${inline[1]}/${inline[2]}`;

  return null;
}

export function extractSpecificLawHint(query: string): string | null {
  const namedLine = extractNamedLawLineFromQuery(query);
  if (namedLine) return namedLine;

  if (FORMAL_CITATION_PATTERN.test(query)) {
    return query.trim();
  }

  const q = query.trim().toLowerCase();
  if (!q) return null;

  const proclamationInParens = query.match(/\((Proclamation\s+[\d\-–—/]+)\)/i);
  if (proclamationInParens?.[1]?.trim()) return proclamationInParens[1].trim();

  const patterns = [
    /more info on this\s+(.+)/i,
    /more information on this\s+(.+)/i,
    /more info on\s+(.+)/i,
    /more information on\s+(.+)/i,
    /tell me about\s+(.+)/i,
    /tell me more about\s+(.+)/i,
    /give me more info on\s+(.+)/i,
  ];
  for (const p of patterns) {
    const m = query.match(p);
    if (m?.[1]?.trim()) {
      let v = m[1].trim();
      v = v.replace(/\s+from\s+[a-z\s'-]+$/i, "").trim();
      v = v.replace(/\s+in\s+[a-z\s'-]+$/i, "").trim();
      if (looksLikeNamedLawTitle(v)) return v;
      return null;
    }
  }

  const trademarksAct = query.match(
    /\b((?:the\s+)?(?:trade\s+)?marks?\s+act(?:\s*\(cap\.?\s*\d+\))?)\b/i
  );
  if (trademarksAct?.[1]?.trim() && looksLikeNamedLawTitle(trademarksAct[1])) return trademarksAct[1].trim();

  const explicitNamedAct =
    query.match(/\b([A-Z][A-Za-z'’\-\s]+?\s+Companies\s+Act(?:\s*[-,]?\s*\d{4})?)\b/i) ||
    query.match(/\b([A-Z][A-Za-z'’\-\s]+?\s+Act(?:\s*No\.?\s*[\d/.-]+)?)\b/i);
  if (explicitNamedAct?.[1]?.trim()) return explicitNamedAct[1].trim();

  const explicitNamedProclamation = query.match(
    /\b([A-Z][A-Za-z'’\-\s]+?\s+Proclamation(?:\s*No\.?\s*[\d/.-]+)?(?:\s*[-–—]\s*\d{4})?)\b/i
  );
  if (explicitNamedProclamation?.[1]?.trim() && looksLikeNamedLawTitle(explicitNamedProclamation[1])) {
    return explicitNamedProclamation[1].trim();
  }

  const frenchNamedInstrument =
    query.match(
      /\b((?:loi|code|décret|decret|arrêté|arrete|ordonnance|règlement|reglement)\s+(?:n[°ºo.]?\s*[\d\-–—/]+\s+)?(?:sur\s+)?[\p{L}\p{N}'’\-\s]{3,80})/iu
    ) ||
    query.match(/\b(code\s+du\s+travail|code\s+fiscal|code\s+p[eé]nal|code\s+des\s+investissements)\b/iu);
  if (frenchNamedInstrument?.[1]?.trim() && looksLikeNamedLawTitle(frenchNamedInstrument[1])) {
    return frenchNamedInstrument[1].trim();
  }

  if (looksLikeNamedLawTitle(query.trim()) && /\b(proclamation|decree|act|code|regulation|ordinance)\b/i.test(query)) {
    return query.trim();
  }

  if (
    q.includes("law no") ||
    q.includes("decree") ||
    q.includes("proclamation") ||
    q.includes("article") ||
    q.includes("loi n") ||
    q.includes("decret") ||
    q.includes("décret")
  ) {
    return query.trim();
  }
  return null;
}

export function scoreLawAgainstSpecificHint(
  law: { title?: string | null },
  hint: string,
  opts?: { isNationalTrademarksActTitle?: (title: string) => boolean }
): number {
  const title = String(law.title ?? "").toLowerCase();
  const hintNorm = normalizeSearchQueryForAi(hint).trim().toLowerCase();
  if (!title || !hintNorm) return 0;
  let score = 0;
  if (title === hintNorm) score += 200;
  if (title.includes(hintNorm) || hintNorm.includes(title)) score += 120;

  const slashCite = extractSlashCitationFromHint(hint);
  if (slashCite && title.includes(slashCite.toLowerCase())) score += 160;

  const hintTokens = hintNorm
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3);
  for (const t of hintTokens) {
    if (title.includes(t)) score += 12;
  }
  for (const englishToken of englishLibraryTokensFromFrenchQuery(hint)) {
    if (title.includes(englishToken.toLowerCase())) score += 18;
  }
  if (opts?.isNationalTrademarksActTitle) {
    if (hintLooksLikeTrademarksAct(hintNorm) && opts.isNationalTrademarksActTitle(title)) {
      score += 120;
    }
    if (hintLooksLikeTrademarksAct(hintNorm) && /\btrade\s+marks?\b/i.test(title)) {
      score += 40;
    }
  }
  const cap = hintNorm.match(/\bcap\.?\s*(\d+)\b/i);
  if (cap?.[1] && title.includes(cap[1])) score += 40;
  if (/\btax\s+administration\b/.test(hintNorm) && /\btax\s+administration\b/.test(title)) score += 80;
  if (/\btax\s+act\b/.test(hintNorm) && /\btax\s+act\b/.test(title) && !/\badministration\b/.test(title)) score += 80;
  return score;
}

export function pickLawsForSpecificHint(
  candidateLaws: any[],
  hint: string,
  opts?: { isNationalTrademarksActTitle?: (title: string) => boolean }
): any[] {
  if (candidateLaws.length === 0) return [];
  const scored = candidateLaws
    .map((law) => ({ law, score: scoreLawAgainstSpecificHint(law, hint, opts) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 20) return candidateLaws.slice(0, 1);
  const tied = scored.filter((s) => s.score >= best.score - 5).map((s) => s.law);
  return tied.slice(0, 2);
}

type FetchLawsByHintOpts = {
  countryId?: string | null;
  countryScopeOr?: string | null;
  internalCategoryId?: string | null;
  lawsSelect: string;
};

function baseLawsQuery(
  supabase: SupabaseClient,
  lawsSelect: string,
  internalCategoryId?: string | null
) {
  return excludeInternalCategoryFromLawsQuery(
    applyLawRagApprovalFilter(
      supabase
        .from("laws")
        .select(lawsSelect)
        .or(LAW_HAS_BODY_OR_FILTER)
        .neq("status", "Repealed")
    ),
    internalCategoryId ?? null
  );
}

/** Direct title lookup when the user names a specific instrument (proclamation numbers, pasted titles). */
export async function fetchLawsMatchingSpecificHint(
  supabase: SupabaseClient,
  hint: string,
  opts: FetchLawsByHintOpts
): Promise<any[]> {
  const { countryId, countryScopeOr, internalCategoryId, lawsSelect } = opts;
  const scopedOr = countryScopeOr ?? null;
  const rows: any[] = [];

  if (hintLooksLikeTrademarksAct(hint)) {
    for (const phrase of trademarkActTitleSearchPhrases()) {
      let tmQuery = baseLawsQuery(supabase, lawsSelect, internalCategoryId).ilike(
        "title",
        `%${escapeIlikePattern(phrase)}%`
      );
      if (countryId) {
        tmQuery = applyCountryScopedTitleSearch(tmQuery, countryId, scopedOr, [phrase]);
      }
      const { data } = await tmQuery.limit(8);
      if (data?.length) rows.push(...(data as any[]));
    }
  }

  const slashCite = extractSlashCitationFromHint(hint);
  if (slashCite) {
    let citeQuery = baseLawsQuery(supabase, lawsSelect, internalCategoryId).ilike(
      "title",
      `%${escapeIlikePattern(slashCite)}%`
    );
    if (countryId) {
      citeQuery = applyCountryScopedTitleSearch(citeQuery, countryId, scopedOr, [slashCite]);
    }
    const { data } = await citeQuery.limit(12);
    if (data?.length) rows.push(...(data as any[]));
  }

  const distinctivePhrase = hint
    .replace(/\((?:Proclamation|Decree|Act|Law|Regulation)\s+[\d\-–—/]+\)/gi, "")
    .replace(/\s*[-–—]\s*\d{4}\s*$/, "")
    .trim();
  if (distinctivePhrase.length >= 24) {
    const phraseNeedle = distinctivePhrase.slice(0, 64);
    let phraseQuery = baseLawsQuery(supabase, lawsSelect, internalCategoryId).ilike(
      "title",
      `%${escapeIlikePattern(phraseNeedle)}%`
    );
    if (countryId) {
      phraseQuery = applyCountryScopedTitleSearch(phraseQuery, countryId, scopedOr, [
        phraseNeedle.slice(0, 32),
      ]);
    }
    const { data } = await phraseQuery.limit(12);
    if (data?.length) rows.push(...(data as any[]));
  }

  const specificStop = new Set([
    "what",
    "does",
    "under",
    "about",
    "article",
    "section",
    "chapter",
    "say",
    "from",
    "this",
    "that",
    "promote",
    "development",
  ]);
  const specificTokens = hint
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !specificStop.has(t))
    .slice(0, 5);
  if (specificTokens.length > 0) {
    let tokenQuery = baseLawsQuery(supabase, lawsSelect, internalCategoryId);
    if (countryId) {
      tokenQuery = applyCountryScopedTitleSearch(tokenQuery, countryId, scopedOr, specificTokens);
    } else if (slashCite) {
      tokenQuery = tokenQuery.ilike("title", `%${escapeIlikePattern(slashCite)}%`);
    } else {
      for (const t of specificTokens) {
        tokenQuery = tokenQuery.ilike("title", `%${escapeIlikePattern(t)}%`);
      }
    }
    const { data } = await tokenQuery.limit(40);
    if (data?.length) rows.push(...(data as any[]));
  }

  const seen = new Set<string>();
  const deduped: any[] = [];
  for (const row of rows) {
    const id = String((row as { id?: string }).id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push(row);
  }
  return deduped;
}
