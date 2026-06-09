/**
 * Categories whose law bodies are for AI reasoning only — hidden from the public library UI/API.
 * AI chat still retrieves them via `fetchAiMethodologyContext` and the contextual brain block,
 * and lists them in AI research source cards as methodology (not as browsable laws).
 */
import { AI_LEGAL_METHODOLOGY_CATEGORY } from "@/lib/ai-contextual-brain";

export { AI_LEGAL_METHODOLOGY_CATEGORY };

const INTERNAL_CATEGORY_NAMES = new Set<string>([AI_LEGAL_METHODOLOGY_CATEGORY]);

/** Titles that must never appear in library search, law detail, or AI source cards. */
const INTERNAL_LIBRARY_TITLE_PATTERNS: RegExp[] = [
  /yamal[eé]\s+ai\s+brain/i,
  /contextual\s+brain/i,
  /ai\s+brain.*\bconfidential\b/i,
  /\bconfidential\b.*ai\s+brain/i,
  /legal\s+system\s+deep\s+dive/i,
  /\bdeep\s+dive\b/i,
];

let cachedInternalCategoryId: string | null | undefined;

export function isInternalLibraryCategoryName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return INTERNAL_CATEGORY_NAMES.has(name.trim());
}

export function isInternalLibraryLawTitle(title: string | null | undefined): boolean {
  if (!title?.trim()) return false;
  const t = title.trim();
  return INTERNAL_LIBRARY_TITLE_PATTERNS.some((re) => re.test(t));
}

export function isInternalLibraryForUserDisplay(law: {
  title?: string | null;
  category?: string | null;
  categories?: { name?: string | null } | null;
  category_id?: string | null;
}, internalCategoryId?: string | null): boolean {
  if (isInternalLibraryLawTitle(law.title)) return true;
  return lawRowIsInternalLibraryCategory(law, internalCategoryId);
}

export function filterPublicLibraryCategories<T extends { name: string }>(categories: T[]): T[] {
  return categories.filter((c) => !isInternalLibraryCategoryName(c.name));
}

export function lawRowIsInternalLibraryCategory(
  law: {
    category_id?: string | null;
    categories?: { name?: string | null } | null;
  },
  internalCategoryId?: string | null
): boolean {
  if (isInternalLibraryCategoryName(law.categories?.name ?? null)) return true;
  if (internalCategoryId && law.category_id === internalCategoryId) return true;
  return false;
}

export function filterPublicLibraryLawRows<
  T extends {
    title?: string | null;
    category_id?: string | null;
    categories?: { name?: string | null } | null;
  },
>(laws: T[], internalCategoryId?: string | null): T[] {
  return laws.filter((law) => !isInternalLibraryForUserDisplay(law, internalCategoryId));
}

/** Resolve Postgres category id once per server instance (for `.neq("category_id", …)` filters). */
export async function resolveInternalLibraryCategoryId(supabase: {
  from: (table: string) => unknown;
}): Promise<string | null> {
  if (cachedInternalCategoryId !== undefined) return cachedInternalCategoryId;
  const { data, error } = await (supabase as { from: (t: string) => any })
    .from("categories")
    .select("id")
    .eq("name", AI_LEGAL_METHODOLOGY_CATEGORY)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[internal-library-categories] category lookup failed:", error.message ?? error);
    cachedInternalCategoryId = null;
    return null;
  }
  cachedInternalCategoryId = (data?.id as string | undefined) ?? null;
  return cachedInternalCategoryId;
}

export function excludeInternalCategoryFromLawsQuery<T extends { neq: (col: string, val: string) => T }>(
  query: T,
  internalCategoryId: string | null
): T {
  if (!internalCategoryId) return query;
  return query.neq("category_id", internalCategoryId);
}

export function clearInternalLibraryCategoryIdCache(): void {
  cachedInternalCategoryId = undefined;
}

/** Split statute RAG hits from internal brain / methodology rows (never user-facing sources). */
export function partitionLegalContextForAiTurn<
  T extends { title?: string | null; category?: string | null },
>(docs: T[], internalCategoryId: string | null, includeInternalInStatuteList = false): {
  statuteDocs: T[];
  internalDocs: T[];
} {
  if (includeInternalInStatuteList) {
    return { statuteDocs: docs, internalDocs: [] };
  }
  const statuteDocs: T[] = [];
  const internalDocs: T[] = [];
  for (const doc of docs) {
    if (isInternalLibraryForUserDisplay(doc, internalCategoryId)) {
      internalDocs.push(doc);
    } else {
      statuteDocs.push(doc);
    }
  }
  return { statuteDocs, internalDocs };
}
