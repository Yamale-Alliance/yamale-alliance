/**
 * Builds a compact title index of laws in Supabase for the AI system prompt (metadata only).
 * Cached briefly to avoid hammering the DB on every chat turn.
 */

const PAGE_SIZE = 1000;
const DEFAULT_MAX_CHARS = 72_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

let catalogCache: { text: string; fetchedAt: number } | null = null;

function maxCatalogChars(): number {
  const raw = process.env.AI_LAW_TITLE_CATALOG_MAX_CHARS?.trim();
  if (!raw) return DEFAULT_MAX_CHARS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 5000 && n <= 500_000 ? n : DEFAULT_MAX_CHARS;
}

export function isLawTitleCatalogForPromptEnabled(): boolean {
  return process.env.AI_LAW_TITLE_CATALOG_DISABLED?.trim() !== "1";
}

/**
 * Returns newline-separated rows: `Title | Country | Category | Status`
 * Truncated to {@link maxCatalogChars} (default 72k). Excludes nothing by status so the index
 * matches “what exists in the library” including Repealed (still listed with status).
 */
export async function fetchLawTitleCatalogForPrompt(supabase: any): Promise<string> {
  if (!isLawTitleCatalogForPromptEnabled()) return "";

  const now = Date.now();
  if (catalogCache && now - catalogCache.fetchedAt < CACHE_TTL_MS) {
    return catalogCache.text;
  }

  const cap = maxCatalogChars();
  const lines: string[] = [];
  let totalLen = 0;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("laws")
      .select("title, status, applies_to_all_countries, countries(name), categories!laws_category_id_fkey(name)")
      .order("title", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[ai-law-title-catalog] query error:", error);
      break;
    }

    const rows = (data ?? []) as Array<{
      title?: string;
      status?: string;
      applies_to_all_countries?: boolean | null;
      countries?: { name?: string } | null;
      categories?: { name?: string } | null;
    }>;

    for (const row of rows) {
      const title = String(row.title ?? "")
        .replace(/\s+/g, " ")
        .trim();
      const country = row.applies_to_all_countries
        ? "All countries"
        : String(row.countries?.name ?? "").trim() || "—";
      const cat = String(row.categories?.name ?? "").trim() || "—";
      const status = String(row.status ?? "").trim() || "—";
      const line = `${title} | ${country} | ${cat} | ${status}`;
      if (totalLen + line.length + 1 > cap) {
        catalogCache = { text: lines.join("\n"), fetchedAt: now };
        return catalogCache.text;
      }
      lines.push(line);
      totalLen += line.length + 1;
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset > 400_000) break;
  }

  const text = lines.join("\n");
  catalogCache = { text, fetchedAt: now };
  return text;
}

/** Call after admin bulk law imports if you need the next chat to see fresh titles immediately. */
export function clearLawTitleCatalogPromptCache(): void {
  catalogCache = null;
}
