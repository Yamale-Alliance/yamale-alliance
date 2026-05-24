/**
 * Full-library AI context: load every in-scope law body for a turn (country + regional/global),
 * with minimal truncation. Opt in with AI_RESEARCH_FULL_LIBRARY=1 (slow).
 */

import { LAW_HAS_BODY_OR_FILTER, filterLawsWithReadableBody } from "@/lib/law-readable-body";

const PAGE_SIZE = 500;

export const FULL_LIBRARY_LAWS_SELECT =
  "id, title, content, content_plain, year, status, metadata, source_name, country_id, applies_to_all_countries, category_id, countries(name), categories!laws_category_id_fkey(name)";

/** Opt-in only (`AI_RESEARCH_FULL_LIBRARY=1`) — very slow; use RAG + streaming by default. */
export function isFullLibraryContextEnabled(): boolean {
  return process.env.AI_RESEARCH_FULL_LIBRARY?.trim() === "1";
}

export function fullLibraryMaxLaws(): number {
  const raw = process.env.AI_FULL_LIBRARY_MAX_LAWS?.trim();
  if (!raw) return 50_000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 50_000;
}

function isProductionEnv(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview")
  );
}

/** Total characters budget across all law bodies in one system prompt. */
export function fullLibraryMaxInputChars(): number {
  const raw = process.env.AI_FULL_LIBRARY_MAX_INPUT_CHARS?.trim();
  const devDefault = 1_500_000;
  const prodDefault = 1_200_000;
  const fallback = isProductionEnv() ? prodDefault : devDefault;
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 500_000 ? n : fallback;
}

export function fullLibraryMaxCharsPerLaw(): number {
  const raw = process.env.AI_FULL_LIBRARY_MAX_CHARS_PER_LAW?.trim();
  const devDefault = 120_000;
  const prodDefault = 100_000;
  const fallback = isProductionEnv() ? prodDefault : devDefault;
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 10_000 ? n : fallback;
}

/**
 * Paginate all non-repealed laws with readable bodies, optionally filtered by country scope OR.
 */
export async function fetchFullLibraryLawRows(
  supabase: any,
  opts: { countryScopeOr: string | null }
): Promise<any[]> {
  const cap = fullLibraryMaxLaws();
  const collected: any[] = [];
  let offset = 0;

  for (;;) {
    if (collected.length >= cap) break;

    let q = supabase
      .from("laws")
      .select(FULL_LIBRARY_LAWS_SELECT)
      .or(LAW_HAS_BODY_OR_FILTER)
      .neq("status", "Repealed")
      .order("title", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (opts.countryScopeOr) {
      q = q.or(opts.countryScopeOr);
    }

    const { data, error } = await q;
    if (error) {
      console.error("[ai-full-library] page error:", error.message ?? error);
      break;
    }

    const batch = filterLawsWithReadableBody((data ?? []) as any[]);
    for (const row of batch) {
      collected.push(row);
      if (collected.length >= cap) break;
    }

    if (!data?.length || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset > 2_000_000) break;
  }

  return collected.slice(0, cap);
}
