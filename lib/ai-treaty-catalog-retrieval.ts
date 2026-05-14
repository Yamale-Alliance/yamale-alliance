import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLawIdsForCategory } from "@/lib/law-categories-sync";

/** Max excerpts for broad "what treaties are in the library" style questions (non–Latin-America-specific). */
export const GLOBAL_TREATY_CATALOG_MAX_DOCS = 28;

const INTERNATIONAL_TRADE_CATEGORY_NAME = "International Trade Laws";

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/**
 * Broad inventory questions about treaties / international agreements in Yamalé
 * (not Latin-America–specific — those use {@link detectLatinAmericaTreatyDiscoveryQuery}).
 */
export function detectGlobalTreatyInventoryQuery(raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (q.length < 12) return false;
  if (
    /\blatin\s+america\b/.test(q) ||
    /\blatam\b/.test(q) ||
    /\blatin\s+american\b/.test(q) ||
    /\bsouth\s+american\b/.test(q) ||
    /\bsouth\s+america\b/.test(q) ||
    /\bcentral\s+america\b/.test(q) ||
    /\bcaribbean\b/.test(q)
  ) {
    return false;
  }
  const inventory =
    /\b(all|every|list|show|what|how many|which|do you have|in the database|in your database|in the library|in yamale)\b/.test(
      q
    );
  const treaty =
    /\b(treat|treaties|treaty|bits?\b|bilateral\s+investment|international\s+agreement|trade\s+agreement|free\s+trade|fta)\b/.test(
      q
    );
  return inventory && treaty;
}

/**
 * Heuristic: cross-border treaty / FTA / BIT style title (excludes many domestic "Act - 2022" titles).
 */
export function titleLooksLikeCrossBorderTreatyTitle(title: string): boolean {
  const t = title.trim();
  if (t.length < 10) return false;
  const lower = t.toLowerCase();
  // Domestic statute captions like "Investment … Act - 2022" (not "Egypt - MERCOSUR FTA - 2010")
  if (/\b(act|proclamation|decree|statute|regulation|code)\b[^-]{0,80}\s[-–—]\s*(?:19|20)\d{2}\b/i.test(t)) {
    if (!/\b(fta|mercosur|treaty|agreement|convention|protocol|between)\b/i.test(lower)) return false;
  }
  if (/\s[-–—]\s*(?:act|proclamation|decree|regulation|statute|order)\b/i.test(t)) return false;
  if (/\b(act|proclamation|decree)\s+no\.?\s*\d/i.test(lower) && !/\b(agreement|treaty|between)\b/i.test(lower)) {
    return false;
  }

  if (/\b(agreement|treaty|treaties|convention|protocol|memorandum|\bmou\b|fta|\bbit\b)\b/i.test(t)) return true;
  if (/\b(free\s+trade|trade\s+and\s+investment|investment\s+promotion|double\s+taxation)\b/i.test(t)) return true;
  if (/\bagreement\s+between\b/i.test(t)) return true;

  if (/\s[-–—]\s/.test(t) && t.length <= 140) {
    const parts = t.split(/\s[-–—]\s/);
    if (parts.length >= 2) {
      const b = parts[1]!.trim();
      if (b.length >= 3 && !/^(no\.|number|part)\s/i.test(b) && !/^\d/.test(b)) return true;
    }
  }
  return false;
}

/** Extra ranking tokens when a global treaty inventory query is active. */
export function globalTreatyRankingLexicon(): string[] {
  return ["treaty", "treaties", "agreement", "bilateral", "investment", "trade", "protocol", "convention"];
}

/**
 * Candidate laws from the International Trade category whose titles look like
 * cross-border treaties (avoids flooding RAG with domestic trade compliance acts).
 */
export async function fetchGlobalTreatyCatalogCandidates(
  supabase: SupabaseClient,
  lawsAiSelect: string
): Promise<unknown[]> {
  const db = supabase as any;
  const { data: catRow, error: catErr } = await db
    .from("categories")
    .select("id")
    .eq("name", INTERNATIONAL_TRADE_CATEGORY_NAME)
    .limit(1)
    .maybeSingle();
  if (catErr || !catRow?.id) return [];

  let lawIds: string[] = [];
  try {
    lawIds = await fetchLawIdsForCategory(supabase, catRow.id as string);
  } catch {
    return [];
  }

  if (lawIds.length === 0) {
    const { data: primaryRows } = await db
      .from("laws")
      .select(lawsAiSelect)
      .eq("category_id", catRow.id)
      .not("content", "is", null)
      .neq("status", "Repealed")
      .limit(400);
    const rows = (primaryRows ?? []) as unknown[];
    return rows.filter((r) => titleLooksLikeCrossBorderTreatyTitle(String((r as any).title ?? "")));
  }

  const maxIds = 4500;
  const capped = lawIds.length > maxIds ? lawIds.slice(0, maxIds) : lawIds;
  const merged: unknown[] = [];
  for (const idChunk of chunkIds(capped, 120)) {
    const { data, error } = await db
      .from("laws")
      .select(lawsAiSelect)
      .in("id", idChunk)
      .not("content", "is", null)
      .neq("status", "Repealed");
    if (error) {
      console.error("[AI RAG] Global treaty catalog chunk fetch:", error.message ?? error);
      continue;
    }
    merged.push(...(data ?? []));
  }

  return merged
    .filter((r) => titleLooksLikeCrossBorderTreatyTitle(String((r as any).title ?? "")))
    .slice(0, 360);
}
