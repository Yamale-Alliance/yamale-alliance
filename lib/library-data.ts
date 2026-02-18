import { getSupabaseServer } from "@/lib/supabase/server";

const LAWS_LIMIT = 500;

export type LibraryCountry = { id: string; name: string };
export type LibraryCategory = { id: string; name: string };
export type LibraryLawRow = {
  id: string;
  title: string;
  status: string;
  country_id: string;
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
};

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
    const [countriesRes, categoriesRes, lawsRes] = await Promise.all([
    supabase.from("countries").select("id, name, region").order("name"),
    supabase.from("categories").select("id, name, slug").order("name"),
    (() => {
      let query = supabase
        .from("laws")
        .select("id, title, source_url, source_name, year, status, country_id, category_id, created_at, updated_at, countries(name), categories(name)")
        .order("title")
        .limit(LAWS_LIMIT);
      if (filters?.countryId) query = query.eq("country_id", filters.countryId);
      if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.q?.trim()) {
        query = query.ilike("title", `%${filters.q.trim()}%`);
      }
      return query;
    })(),
  ]);

  if (countriesRes.error) throw countriesRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  if (lawsRes.error) throw lawsRes.error;

  const data: LibraryData = {
    countries: (countriesRes.data ?? []) as LibraryCountry[],
    categories: (categoriesRes.data ?? []) as LibraryCategory[],
    laws: (lawsRes.data ?? []) as LibraryLawRow[],
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
