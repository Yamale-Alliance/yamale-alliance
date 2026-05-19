import { prioritizeTokensForLibrarySearch } from "@/lib/ai-library-search-intent";
import {
  escapeIlikePattern,
  lawsCountryOrGlobalWithAnyEscapedTerms,
} from "@/lib/law-country-scope";

/** PostgREST `.or()` filters longer than this often 400 or time out on Supabase. */
export const POSTGREST_MAX_OR_FILTER_LEN = 960;

/** Strip accents and non-ASCII so ILIKE filters survive URL encoding (e.g. propriété → propriete). */
export function foldForPostgrestSearch(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** Split phrases into ASCII words suitable for `ilike` (no spaces in filter values). */
export function tokenWordsForPostgrestSearch(raw: string): string[] {
  const folded = foldForPostgrestSearch(raw);
  if (!folded) return [];
  return folded
    .split(/[^a-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && w.length <= 22);
}

export function buildPostgrestSearchWords(terms: string[], primaryId: string): string[] {
  const words: string[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    for (const w of tokenWordsForPostgrestSearch(term)) {
      const k = w.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        words.push(w);
      }
    }
  }
  return prioritizeTokensForLibrarySearch(words, primaryId);
}

/**
 * Escaped tokens for country-scoped `.or()` filters, capped by length and count.
 */
export function buildPostgrestEscapedTokens(
  countryId: string,
  terms: string[],
  primaryId: string,
  opts?: { maxTokens?: number; maxOrFilterLen?: number }
): string[] {
  const maxTokens = opts?.maxTokens ?? 2;
  const maxOrFilterLen = opts?.maxOrFilterLen ?? POSTGREST_MAX_OR_FILTER_LEN;
  const words = buildPostgrestSearchWords(terms, primaryId);
  const out: string[] = [];

  for (const word of words) {
    if (out.length >= maxTokens) break;
    const esc = escapeIlikePattern(word);
    const trial = lawsCountryOrGlobalWithAnyEscapedTerms(countryId, [...out, esc]);
    if (trial.length > maxOrFilterLen) continue;
    out.push(esc);
  }

  if (out.length === 0 && words.length > 0) {
    out.push(escapeIlikePattern(words[0]!));
  }
  return out;
}

export function logPostgrestError(label: string, error: unknown, extra?: Record<string, unknown>) {
  const e = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  } | null;
  console.error(label, {
    message: e?.message ?? String(error),
    details: e?.details,
    hint: e?.hint,
    code: e?.code,
    ...extra,
  });
}
