import { getSupabaseServer } from "@/lib/supabase/server";
import { lawsOrGlobalForCountry } from "@/lib/law-country-scope";

/** Max laws returned in one response (pagination is client-side within this set). */
const LAWS_LIMIT = 20_000;

export type LibraryCountry = { id: string; name: string };
export type LibraryCategory = { id: string; name: string };
export type LibraryLawRow = {
  id: string;
  title: string;
  status: string;
  country_id: string | null;
  applies_to_all_countries: boolean;
  category_id: string;
  countries: { name: string } | null;
  categories: { name: string } | null;
  created_at?: string;
  updated_at?: string;
};

export type LibraryData = {
  countries: LibraryCountry[];
  categories: LibraryCategory[];
  laws: LibraryLawRow[];
  /** Total rows matching filters in the database (may exceed laws.length if capped). */
  lawCount: number;
};

function sortCountriesAlphabetically(countries: LibraryCountry[]): LibraryCountry[] {
  return [...countries].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute
const FETCH_TIMEOUT_MS = 20 * 1000; // 20s max wait so page never hangs
let cachedData: LibraryData | null = null;
let cacheTimestamp = 0;

function cacheKey(filters?: { countryId?: string; categoryId?: string; status?: string; q?: string }): string {
  if (!filters) return "__initial__";
  return [filters.countryId ?? "", filters.categoryId ?? "", filters.status ?? "", (filters.q ?? "").trim()].join("|");
}

function doFetch(filters: Parameters<typeof fetchLibraryData>[0]): Promise<LibraryData> {
  const key = cacheKey(filters);
  const supabase = getSupabaseServer();
  return (async () => {
    let countQuery = supabase.from("laws").select("id", { count: "exact", head: true });
    if (filters?.countryId) countQuery = countQuery.or(lawsOrGlobalForCountry(filters.countryId));
    if (filters?.categoryId) countQuery = countQuery.eq("category_id", filters.categoryId);
    if (filters?.status) countQuery = countQuery.eq("status", filters.status);
    if (filters?.q?.trim()) {
      countQuery = countQuery.ilike("title", `%${filters.q.trim()}%`);
    }

    let lawsQuery = supabase
      .from("laws")
      .select(
        "id, title, source_url, source_name, year, status, country_id, applies_to_all_countries, category_id, created_at, updated_at, countries(name), categories(name)"
      )
      .order("created_at", { ascending: false })
      .order("title")
      .limit(LAWS_LIMIT);
    if (filters?.countryId) lawsQuery = lawsQuery.or(lawsOrGlobalForCountry(filters.countryId));
    if (filters?.categoryId) lawsQuery = lawsQuery.eq("category_id", filters.categoryId);
    if (filters?.status) lawsQuery = lawsQuery.eq("status", filters.status);
    if (filters?.q?.trim()) {
      lawsQuery = lawsQuery.ilike("title", `%${filters.q.trim()}%`);
    }

    const [countriesRes, categoriesRes, countRes, lawsRes] = await Promise.all([
      supabase.from("countries").select("id, name, region").order("name"),
      supabase.from("categories").select("id, name, slug").order("name"),
      countQuery,
      lawsQuery,
    ]);

  if (countriesRes.error) throw countriesRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  if (countRes.error) throw countRes.error;
  if (lawsRes.error) throw lawsRes.error;

  const lawCount = typeof countRes.count === "number" ? countRes.count : (lawsRes.data ?? []).length;

  const data: LibraryData = {
    countries: sortCountriesAlphabetically((countriesRes.data ?? []) as LibraryCountry[]),
    categories: (categoriesRes.data ?? []) as LibraryCategory[],
    laws: (lawsRes.data ?? []) as LibraryLawRow[],
    lawCount,
  };

  if (key === "__initial__") {
    cachedData = data;
    cacheTimestamp = Date.now();
  }

  return data;
  })();
}

export async function fetchLibraryData(filters?: {
  countryId?: string;
  categoryId?: string;
  status?: string;
  q?: string;
}): Promise<LibraryData> {
  const key = cacheKey(filters);
  const now = Date.now();
  if (key === "__initial__" && cachedData && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedData;
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Library load timeout")), FETCH_TIMEOUT_MS);
  });

  try {
    const data = await Promise.race([doFetch(filters), timeoutPromise]);
    return data;
  } catch (err) {
    if (key === "__initial__" && cachedData) {
      return cachedData;
    }
    throw err;
  }
}
