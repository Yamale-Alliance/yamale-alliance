/**
 * Builds a compact title index of laws in Supabase for the AI system prompt (metadata only).
 * Cached briefly to avoid hammering the DB on every chat turn.
 */

import { isFullLibraryContextEnabled } from "@/lib/ai-full-library-context";
import { lawsOrGlobalForCountry } from "@/lib/law-country-scope";
import { resolveCountryIdCached } from "@/lib/country-resolution-cache";
import { lawSourceDisplayLabel } from "@/lib/law-source-display";

const PAGE_SIZE = 1000;
const DEFAULT_MAX_CHARS = 24_000;
const GLOBAL_CATALOG_MAX_CHARS = 72_000;
const FULL_LIBRARY_CATALOG_MAX_CHARS = 2_000_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

type CatalogCacheEntry = { text: string; fetchedAt: number };
const catalogCacheByScope = new Map<string, CatalogCacheEntry>();

function maxCatalogChars(scopedToCountry: boolean): number {
  const raw = process.env.AI_LAW_TITLE_CATALOG_MAX_CHARS?.trim();
  const defaultCap = isFullLibraryContextEnabled()
    ? FULL_LIBRARY_CATALOG_MAX_CHARS
    : scopedToCountry
      ? DEFAULT_MAX_CHARS
      : GLOBAL_CATALOG_MAX_CHARS;
  if (!raw) return defaultCap;
  const n = Number.parseInt(raw, 10);
  const ceiling = isFullLibraryContextEnabled() ? 5_000_000 : 500_000;
  return Number.isFinite(n) && n >= 5000 && n <= ceiling ? n : defaultCap;
}

export function isLawTitleCatalogForPromptEnabled(): boolean {
  return process.env.AI_LAW_TITLE_CATALOG_DISABLED?.trim() !== "1";
}

/**
 * Inventory / coverage questions need the metadata index; focused statute Q&A can skip it when RAG already hit acts.
 */
export function queryNeedsLawTitleCatalog(userQuery: string, hasCountryScope: boolean): boolean {
  if (process.env.AI_LAW_TITLE_CATALOG_ALWAYS?.trim() === "1") return true;
  const q = userQuery.toLowerCase();
  if (
    /\b(what laws|which laws|how many laws|do you have|list (all )?(the )?laws|in (the )?library|law count|coverage|catalog|index)\b/.test(
      q
    )
  ) {
    return true;
  }
  if (!hasCountryScope) return true;
  return false;
}

/**
 * Returns newline-separated rows: `Title | Source | Category | Status`
 * Truncated to {@link maxCatalogChars} (default 72k). Excludes nothing by status so the index
 * matches “what exists in the library” including Repealed (still listed with status).
 */
export type LawTitleCatalogOpts = {
  /** When set, catalog lists only this country + global instruments (much smaller prompt). */
  countryName?: string | null;
};

export async function fetchLawTitleCatalogForPrompt(
  supabase: any,
  opts?: LawTitleCatalogOpts
): Promise<string> {
  if (!isLawTitleCatalogForPromptEnabled()) return "";

  let countryId: string | null = null;
  const countryName = opts?.countryName?.trim();
  if (countryName) {
    countryId = await resolveCountryIdCached(countryName);
  }

  const cacheKey = countryId ?? "global";
  const now = Date.now();
  const cached = catalogCacheByScope.get(cacheKey);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.text;
  }

  const cap = maxCatalogChars(Boolean(countryId));
  const lines: string[] = [];
  let totalLen = 0;
  let offset = 0;

  for (;;) {
    let q = supabase
      .from("laws")
      .select(
        "title, status, source_name, applies_to_all_countries, country_id, countries(name), categories!laws_category_id_fkey(name)"
      )
      .order("title", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (countryId) {
      q = q.or(lawsOrGlobalForCountry(countryId));
    }

    const { data, error } = await q;

    if (error) {
      console.error("[ai-law-title-catalog] query error:", error);
      break;
    }

    const rows = (data ?? []) as Array<{
      title?: string;
      status?: string;
      source_name?: string | null;
      applies_to_all_countries?: boolean | null;
      countries?: { name?: string } | null;
      categories?: { name?: string } | null;
    }>;

    const seenTitles = new Set<string>();
    for (const row of rows) {
      const title = String(row.title ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (!title) continue;
      const titleKey = title.toLowerCase();
      if (seenTitles.has(titleKey)) continue;
      seenTitles.add(titleKey);
      const source =
        lawSourceDisplayLabel(row) ||
        (row.applies_to_all_countries ? "Multiple countries" : "—");
      const cat = String(row.categories?.name ?? "").trim() || "—";
      const status = String(row.status ?? "").trim() || "—";
      const line = `${title} | ${source} | ${cat} | ${status}`;
      if (totalLen + line.length + 1 > cap) {
        const text = lines.join("\n");
        catalogCacheByScope.set(cacheKey, { text, fetchedAt: now });
        return text;
      }
      lines.push(line);
      totalLen += line.length + 1;
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset > 400_000) break;
  }

  const text = lines.join("\n");
  catalogCacheByScope.set(cacheKey, { text, fetchedAt: now });
  return text;
}

/** Call after admin bulk law imports if you need the next chat to see fresh titles immediately. */
export function clearLawTitleCatalogPromptCache(): void {
  catalogCacheByScope.clear();
}
