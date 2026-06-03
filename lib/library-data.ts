import { getSupabaseServer } from "@/lib/supabase/server";
import { librarySearchMatchPlan, lawRowMatchesLibrarySearch } from "@/lib/library-client-search";
import {
  escapeIlikePattern,
  lawsCountryGlobalOrScopedIds,
  postgrestIlikePattern,
} from "@/lib/law-country-scope";
import { POSTGREST_MAX_OR_FILTER_LEN } from "@/lib/postgrest-ilike-tokens";
import { fetchLawIdsForCategory } from "@/lib/law-categories-sync";
import { fetchLawIdsForCountryScope } from "@/lib/law-country-scope-ids";
import {
  excludeInternalCategoryFromLawsQuery,
  filterPublicLibraryCategories,
  filterPublicLibraryLawRows,
  resolveInternalLibraryCategoryId,
} from "@/lib/internal-library-categories";

/** Max laws returned in one response (admin bulk / legacy API without pagination). */
const LAWS_LIMIT = 20_000;

/** Public library grid: one server page at a time. */
export const LIBRARY_PAGE_SIZE = 12;

export type LibrarySortOption = "title-asc" | "title-desc" | "country" | "category" | "newest";

/** PostgREST returns at most 1000 rows per request unless max-rows is raised server-side. */
const POSTGREST_PAGE_SIZE = 1000;

export type LibraryCountry = { id: string; name: string };
export type LibraryCategory = { id: string; name: string };
export type LibraryLawRow = {
  id: string;
  slug?: string | null;
  title: string;
  year?: number | null;
  source_name?: string | null;
  status: string;
  treaty_type?: string | null;
  country_id: string | null;
  applies_to_all_countries: boolean;
  category_id: string;
  /** All category IDs this law is filed under (library filters). */
  all_category_ids?: string[];
  countries: { name: string } | null;
  categories: { name: string } | null;
  created_at?: string;
  updated_at?: string;
  last_verified_at?: string | null;
  /** True when this law is in a cross-country shared link group (admin-only flair in UI). */
  is_linked_shared_law?: boolean;
};

export type LibraryData = {
  countries: LibraryCountry[];
  categories: LibraryCategory[];
  laws: LibraryLawRow[];
  /** Total rows matching filters in the database (may exceed laws.length if capped). */
  lawCount: number;
};

type LibraryFilters = {
  countryId?: string;
  categoryId?: string;
  /** Resolve to countryId via cached meta (avoids duplicate fetchLibraryMeta on page). */
  countryName?: string;
  categoryName?: string;
  status?: string;
  q?: string;
  /** 1-based page index (public library). When set with pageSize, only that slice is fetched. */
  page?: number;
  pageSize?: number;
  sort?: LibrarySortOption;
  yearFrom?: string;
  yearTo?: string;
  treatyType?: string;
  documentType?: string;
  /** Cap rows returned (admin bulk). Ignored when page/pageSize are set. */
  lawsLimit?: number;
  /** Skip law_categories + shared-link lookups (faster; used by admin list). */
  skipEnrichment?: boolean;
  /** Admin-only linked-law flair; skips extra DB round-trips on public library loads. */
  includeLinkedLawFlairs?: boolean;
};

const ENRICHMENT_ID_CHUNK = 500;

function sortCountriesAlphabetically(countries: LibraryCountry[]): LibraryCountry[] {
  return [...countries].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

function buildSearchOrFilter(query: string): string | null {
  const plan = librarySearchMatchPlan(query);
  const parts: string[] = [];
  const tryAdd = (clause: string): boolean => {
    const next = parts.length === 0 ? clause : `${parts.join(",")},${clause}`;
    if (next.length > POSTGREST_MAX_OR_FILTER_LEN) return false;
    parts.push(clause);
    return true;
  };
  // Title tokens only — PostgREST rejects `categories.name` inside `.or()` on `laws`
  // (PGRST100). Category hints are still applied client-side via lawRowMatchesLibrarySearch.
  for (const t of plan.matchTokens.slice(0, 8)) {
    if (!tryAdd(`title.ilike.%${postgrestIlikePattern(t)}%`)) break;
  }
  if (parts.length === 0) return null;
  return parts.join(",");
}

function sanitizeLibraryDataForPublic(
  data: LibraryData,
  internalCategoryId: string | null
): LibraryData {
  const laws = filterPublicLibraryLawRows(data.laws, internalCategoryId);
  const removed = data.laws.length - laws.length;
  const lawCount = removed > 0 ? Math.max(0, data.lawCount - removed) : data.lawCount;
  return {
    countries: data.countries,
    categories: filterPublicLibraryCategories(data.categories),
    laws,
    lawCount,
  };
}

function applyFiltersToCachedData(
  base: LibraryData,
  filters?: LibraryFilters,
  internalCategoryId?: string | null
): LibraryData {
  const publicBase = sanitizeLibraryDataForPublic(base, internalCategoryId ?? null);
  if (!filters) return publicBase;
  if (filters.categoryId && filters.categoryId === internalCategoryId) {
    return { ...publicBase, laws: [], lawCount: 0 };
  }
  const searchPlan = filters.q?.trim() ? librarySearchMatchPlan(filters.q) : null;
  const filteredLaws = publicBase.laws.filter((law) => {
    const matchCountry =
      !filters.countryId || law.country_id === filters.countryId || law.applies_to_all_countries;
    if (!matchCountry) return false;
    const matchCategory =
      !filters.categoryId ||
      law.category_id === filters.categoryId ||
      (law.all_category_ids?.includes(filters.categoryId) ?? false);
    if (!matchCategory) return false;
    const matchStatus = !filters.status || law.status === filters.status;
    if (!matchStatus) return false;
    if (!searchPlan) return true;
    return lawRowMatchesLibrarySearch(
      {
        title: law.title ?? "",
        category: law.categories?.name ?? "",
        country: law.countries?.name ?? "",
        sourceName: law.source_name,
      },
      searchPlan
    );
  });

  return {
    countries: publicBase.countries,
    categories: publicBase.categories,
    laws: filteredLaws,
    lawCount: filteredLaws.length,
  };
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute
const FETCH_TIMEOUT_MS = 55 * 1000; // large catalogs + enrichment; parallelized below
/**
 * PostgREST builds very long URLs for `.in("id", [hundreds of UUIDs])`, which can exceed
 * Node/undici header limits (~16KB). Chunking keeps each request small.
 */
const CATEGORY_ID_IN_CHUNK = 80;

const LAWS_SELECT_FIELDS =
  "id, slug, title, source_name, year, status, treaty_type, country_id, applies_to_all_countries, category_id, created_at, updated_at, last_verified_at, countries(name), categories!laws_category_id_fkey(name)";

let cachedData: LibraryData | null = null;
let cacheTimestamp = 0;

function cacheKey(filters?: LibraryFilters): string {
  if (!filters) return "__initial__";
  if (filters.page != null || filters.pageSize != null) {
    return [
      "page",
      String(filters.page ?? 1),
      String(filters.pageSize ?? LIBRARY_PAGE_SIZE),
      filters.countryId ?? "",
      filters.categoryId ?? "",
      filters.status ?? "",
      (filters.q ?? "").trim(),
      filters.sort ?? "title-asc",
      filters.yearFrom ?? "",
      filters.yearTo ?? "",
      filters.treatyType ?? "",
      filters.documentType ?? "",
    ].join("|");
  }
  const partial =
    filters.lawsLimit != null && filters.lawsLimit < LAWS_LIMIT
      ? `:limit:${filters.lawsLimit}`
      : "";
  return [
    filters.countryId ?? "",
    filters.categoryId ?? "",
    filters.status ?? "",
    (filters.q ?? "").trim(),
    partial,
  ].join("|");
}

function isPaginatedRequest(filters?: LibraryFilters): boolean {
  return filters?.page != null || filters?.pageSize != null;
}

function parseYearFilter(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const y = Number.parseInt(value, 10);
  return Number.isFinite(y) ? y : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyScalarLibraryFilters(query: any, filters?: LibraryFilters): any {
  let q = query;
  const minYear = parseYearFilter(filters?.yearFrom);
  const maxYear = parseYearFilter(filters?.yearTo);
  if (minYear != null) q = q.gte("year", minYear);
  if (maxYear != null) q = q.lte("year", maxYear);
  if (filters?.treatyType?.trim()) {
    const term = escapeIlikePattern(filters.treatyType.trim());
    q = q.ilike("treaty_type", `%${term}%`);
  }
  if (filters?.documentType?.trim()) {
    const term = escapeIlikePattern(filters.documentType.trim().toLowerCase());
    q = q.or(`title.ilike.%${term}%,source_name.ilike.%${term}%`);
  }
  return q;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyLibrarySort(query: any, sort?: LibrarySortOption): any {
  switch (sort) {
    case "title-desc":
      return query.order("title", { ascending: false });
    case "newest":
      return query.order("created_at", { ascending: false }).order("title", { ascending: true });
    case "country":
      return query.order("country_id", { ascending: true, nullsFirst: false }).order("title", { ascending: true });
    case "category":
      return query.order("category_id", { ascending: true }).order("title", { ascending: true });
    case "title-asc":
    default:
      return query.order("title", { ascending: true });
  }
}

/** Fetch a single page of law rows (PostgREST range). */
async function fetchLibraryLawPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyLawRowFilters: (query: any) => any,
  page: number,
  pageSize: number,
  sort?: LibrarySortOption
): Promise<LibraryLawRow[]> {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;
  let base = supabase.from("laws").select(LAWS_SELECT_FIELDS);
  base = applyLawRowFilters(base);
  base = applyLibrarySort(base, sort);
  const { data, error } = await base.range(offset, offset + pageSize - 1);
  if (error) throw error;
  return (data ?? []) as LibraryLawRow[];
}

function chunkIds<T>(ids: T[], size: number): T[][] {
  if (size <= 0) return [ids];
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

async function fetchLawCategoryIdsMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  lawIds: string[]
): Promise<Map<string, string[]>> {
  const catMap = new Map<string, string[]>();
  if (lawIds.length === 0) return catMap;
  try {
    const chunks = chunkIds(lawIds, ENRICHMENT_ID_CHUNK);
    const batches = await Promise.all(
      chunks.map(async (chunk) => {
        const { data: lcRows, error: lcErr } = await supabase
          .from("law_categories")
          .select("law_id, category_id")
          .in("law_id", chunk);
        if (lcErr || !lcRows) return [];
        return lcRows as { law_id: string; category_id: string }[];
      })
    );
    for (const r of batches.flat()) {
      const arr = catMap.get(r.law_id) ?? [];
      arr.push(r.category_id);
      catMap.set(r.law_id, arr);
    }
  } catch {
    return new Map();
  }
  return catMap;
}

async function fetchLinkedLawIdSet(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  lawIds: string[]
): Promise<Set<string>> {
  const linkedLawIds = new Set<string>();
  if (lawIds.length === 0) return linkedLawIds;
  try {
    const chunks = chunkIds(lawIds, ENRICHMENT_ID_CHUNK);
    const batches = await Promise.all(
      chunks.map(async (chunk) => {
        const { data: mRows, error: mErr } = await supabase
          .from("law_shared_group_members")
          .select("law_id")
          .in("law_id", chunk);
        if (mErr || !mRows) return [];
        return mRows as { law_id: string }[];
      })
    );
    for (const r of batches.flat()) {
      if (r.law_id) linkedLawIds.add(r.law_id);
    }
  } catch {
    /* law_shared_group_members may be missing on older DBs */
  }
  return linkedLawIds;
}

function compareLibraryLawRows(a: LibraryLawRow, b: LibraryLawRow): number {
  const ta = new Date(a.created_at ?? 0).getTime();
  const tb = new Date(b.created_at ?? 0).getTime();
  if (tb !== ta) return tb - ta;
  return (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" });
}

/** Load the full matching catalog in pages (Supabase caps each response at 1000 rows). */
async function fetchPaginatedLibraryLawRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  applyFilters: (query: any) => any,
  maxRows: number = LAWS_LIMIT
): Promise<LibraryLawRow[]> {
  const rows: LibraryLawRow[] = [];
  let offset = 0;
  while (rows.length < maxRows) {
    const base = supabase
      .from("laws")
      .select(LAWS_SELECT_FIELDS)
      .order("created_at", { ascending: false })
      .order("title");
    const { data, error } = await applyFilters(base).range(
      offset,
      offset + POSTGREST_PAGE_SIZE - 1
    );
    if (error) throw error;
    const batch = (data ?? []) as LibraryLawRow[];
    rows.push(...batch);
    if (batch.length < POSTGREST_PAGE_SIZE) break;
    offset += POSTGREST_PAGE_SIZE;
  }
  return rows.slice(0, maxRows);
}

async function sumExactLawCountsInIdChunks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  lawIds: string[],
  filters: LibraryFilters | undefined,
  scopedCountryLawIds: string[],
  internalCategoryId: string | null
): Promise<number> {
  const chunks = chunkIds(lawIds, CATEGORY_ID_IN_CHUNK);
  const counts = await Promise.all(
    chunks.map(async (idChunk) => {
      let q = excludeInternalCategoryFromLawsQuery(
        supabase.from("laws").select("id", { count: "exact", head: true }).in("id", idChunk),
        internalCategoryId
      );
      if (filters?.countryId) {
        q = q.or(lawsCountryGlobalOrScopedIds(filters.countryId, scopedCountryLawIds));
      }
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.q?.trim()) {
        const term = escapeIlikePattern(filters.q.trim());
        q = q.ilike("title", `%${term}%`);
      }
      const { count, error } = await q;
      if (error) throw error;
      return typeof count === "number" ? count : 0;
    })
  );
  return counts.reduce((a, b) => a + b, 0);
}

async function fetchLawsRowsInIdChunks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  lawIds: string[],
  filters: LibraryFilters | undefined,
  scopedCountryLawIds: string[],
  internalCategoryId: string | null,
  maxRows: number = LAWS_LIMIT
): Promise<LibraryLawRow[]> {
  const chunks = chunkIds(lawIds, CATEGORY_ID_IN_CHUNK);
  const batches = await Promise.all(
    chunks.map(async (idChunk) => {
      let q = supabase
        .from("laws")
        .select(LAWS_SELECT_FIELDS)
        .in("id", idChunk)
        .order("created_at", { ascending: false })
        .order("title");
      q = excludeInternalCategoryFromLawsQuery(q, internalCategoryId);
      if (filters?.countryId) {
        q = q.or(lawsCountryGlobalOrScopedIds(filters.countryId, scopedCountryLawIds));
      }
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.q?.trim()) {
        const term = escapeIlikePattern(filters.q.trim());
        q = q.ilike("title", `%${term}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LibraryLawRow[];
    })
  );
  const merged = new Map<string, LibraryLawRow>();
  for (const row of batches.flat()) {
    merged.set(row.id, row);
  }
  return Array.from(merged.values()).sort(compareLibraryLawRows).slice(0, maxRows);
}

async function resolveLibraryFilterIds(
  filters: LibraryFilters | undefined
): Promise<LibraryFilters | undefined> {
  if (!filters) return filters;
  if (!filters.countryName && !filters.categoryName) return filters;
  if (filters.countryId && filters.categoryId) return filters;

  const meta = await fetchLibraryMeta();
  const countryId =
    filters.countryId ??
    (filters.countryName
      ? meta.countries.find((c) => c.name === filters.countryName)?.id
      : undefined);
  const categoryId =
    filters.categoryId ??
    (filters.categoryName
      ? meta.categories.find((c) => c.name === filters.categoryName)?.id
      : undefined);

  const { countryName: _cn, categoryName: _catn, ...rest } = filters;
  return { ...rest, countryId, categoryId };
}

function doFetch(filters: Parameters<typeof fetchLibraryData>[0]): Promise<LibraryData> {
  const key = cacheKey(filters);
  const supabase = getSupabaseServer();
  return (async () => {
    const internalCategoryId = await resolveInternalLibraryCategoryId(supabase);
    if (filters?.categoryId && internalCategoryId && filters.categoryId === internalCategoryId) {
      const [countriesRes, categoriesRes] = await Promise.all([
        supabase.from("countries").select("id, name, region").order("name"),
        supabase.from("categories").select("id, name, slug").order("name"),
      ]);
      if (countriesRes.error) throw countriesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      return {
        countries: sortCountriesAlphabetically((countriesRes.data ?? []) as LibraryCountry[]),
        categories: filterPublicLibraryCategories((categoriesRes.data ?? []) as LibraryCategory[]),
        laws: [],
        lawCount: 0,
      };
    }

    const scopedCountryLawIds =
      filters?.countryId ? await fetchLawIdsForCountryScope(supabase, filters.countryId) : [];
    let categoryLawIds: string[] | null = null;
    let useLegacyCategoryColumn = false;
    const paginated = isPaginatedRequest(filters);
    if (filters?.categoryId) {
      // Country-scoped category filtering should remain resilient even when some older
      // rows were not backfilled into law_categories yet.
      if (filters.countryId || paginated) {
        useLegacyCategoryColumn = true;
      } else {
        try {
          categoryLawIds = await fetchLawIdsForCategory(supabase, filters.categoryId);
        } catch {
          categoryLawIds = null;
          useLegacyCategoryColumn = true;
        }
      }
      if (!useLegacyCategoryColumn && categoryLawIds !== null && categoryLawIds.length === 0) {
        const [countriesRes, categoriesRes] = await Promise.all([
          supabase.from("countries").select("id, name, region").order("name"),
          supabase.from("categories").select("id, name, slug").order("name"),
        ]);
        if (countriesRes.error) throw countriesRes.error;
        if (categoriesRes.error) throw categoriesRes.error;
        const empty: LibraryData = {
          countries: sortCountriesAlphabetically((countriesRes.data ?? []) as LibraryCountry[]),
          categories: filterPublicLibraryCategories((categoriesRes.data ?? []) as LibraryCategory[]),
          laws: [],
          lawCount: 0,
        };
        if (key === "__initial__") {
          cachedData = empty;
          cacheTimestamp = Date.now();
        }
        return empty;
      }
    }

    const useJunctionIdChunks =
      Boolean(categoryLawIds && categoryLawIds.length > 0 && !useLegacyCategoryColumn);

    const countriesPromise = supabase.from("countries").select("id, name, region").order("name");
    const categoriesPromise = supabase.from("categories").select("id, name, slug").order("name");

    let countriesRes: Awaited<typeof countriesPromise>;
    let categoriesRes: Awaited<typeof categoriesPromise>;
    let lawCount: number;
    let rawLaws: LibraryLawRow[];

    const rowCap = paginated ? LIBRARY_PAGE_SIZE : (filters?.lawsLimit ?? LAWS_LIMIT);
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.max(1, Math.min(filters?.pageSize ?? LIBRARY_PAGE_SIZE, 100));

    if (useJunctionIdChunks && !paginated) {
      [countriesRes, categoriesRes] = await Promise.all([countriesPromise, categoriesPromise]);
      if (countriesRes.error) throw countriesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      const junctionIds = categoryLawIds as string[];
      [lawCount, rawLaws] = await Promise.all([
        sumExactLawCountsInIdChunks(
          supabase,
          junctionIds,
          filters,
          scopedCountryLawIds,
          internalCategoryId
        ),
        fetchLawsRowsInIdChunks(
          supabase,
          junctionIds,
          filters,
          scopedCountryLawIds,
          internalCategoryId,
          rowCap
        ),
      ]);
    } else {
      // `count: "exact"` can be expensive on larger datasets and was causing
      // transient 20s timeouts. `planned` is much faster and good enough for UI totals.
      let countQuery = excludeInternalCategoryFromLawsQuery(
        supabase.from("laws").select("id", { count: "planned", head: true }),
        internalCategoryId
      );
      if (filters?.countryId) {
        countQuery = countQuery.or(lawsCountryGlobalOrScopedIds(filters.countryId, scopedCountryLawIds));
      }
      if (useLegacyCategoryColumn && filters?.categoryId) {
        countQuery = countQuery.eq("category_id", filters.categoryId);
      } else if (categoryLawIds && categoryLawIds.length > 0) {
        countQuery = countQuery.in("id", categoryLawIds);
      }
      if (filters?.status) countQuery = countQuery.eq("status", filters.status);
      if (filters?.q?.trim()) {
        const orFilter = buildSearchOrFilter(filters.q);
        if (orFilter) countQuery = countQuery.or(orFilter);
        else {
          const term = escapeIlikePattern(filters.q.trim());
          countQuery = countQuery.ilike("title", `%${term}%`);
        }
      }
      countQuery = applyScalarLibraryFilters(countQuery, filters);

      const applyLawRowFilters = (query: ReturnType<typeof supabase.from>) => {
        let lawsQuery = query;
        if (filters?.countryId) {
          lawsQuery = lawsQuery.or(lawsCountryGlobalOrScopedIds(filters.countryId, scopedCountryLawIds));
        }
        if (useLegacyCategoryColumn && filters?.categoryId) {
          lawsQuery = lawsQuery.eq("category_id", filters.categoryId);
        } else if (categoryLawIds && categoryLawIds.length > 0) {
          lawsQuery = lawsQuery.in("id", categoryLawIds);
        }
        if (filters?.status) lawsQuery = lawsQuery.eq("status", filters.status);
        if (filters?.q?.trim()) {
          const orFilter = buildSearchOrFilter(filters.q);
          if (orFilter) lawsQuery = lawsQuery.or(orFilter);
          else {
            const term = escapeIlikePattern(filters.q.trim());
            lawsQuery = lawsQuery.ilike("title", `%${term}%`);
          }
        }
        lawsQuery = applyScalarLibraryFilters(lawsQuery, filters);
        return excludeInternalCategoryFromLawsQuery(lawsQuery, internalCategoryId);
      };

      if (paginated) {
        const [cRes, catRes, countRes, pageLaws] = await Promise.all([
          countriesPromise,
          categoriesPromise,
          countQuery,
          fetchLibraryLawPage(supabase, applyLawRowFilters, page, pageSize, filters?.sort),
        ]);
        countriesRes = cRes;
        categoriesRes = catRes;
        if (countriesRes.error) throw countriesRes.error;
        if (categoriesRes.error) throw categoriesRes.error;
        if (countRes.error) throw countRes.error;
        lawCount = typeof countRes.count === "number" ? countRes.count : pageLaws.length;
        rawLaws = pageLaws;
      } else {
      const [cRes, catRes, countRes, paginatedLaws] = await Promise.all([
        countriesPromise,
        categoriesPromise,
        countQuery,
        fetchPaginatedLibraryLawRows(supabase, applyLawRowFilters, rowCap),
      ]);
      countriesRes = cRes;
      categoriesRes = catRes;
      if (countriesRes.error) throw countriesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (countRes.error) throw countRes.error;

      lawCount = typeof countRes.count === "number" ? countRes.count : paginatedLaws.length;
      rawLaws = paginatedLaws;
      }
    }

    const ids = rawLaws.map((l) => l.id);
    let catMap = new Map<string, string[]>();
    let linkedLawIds = new Set<string>();
    if (ids.length > 0 && !filters?.skipEnrichment) {
      catMap = await fetchLawCategoryIdsMap(supabase, ids);
      if (filters?.includeLinkedLawFlairs) {
        linkedLawIds = await fetchLinkedLawIdSet(supabase, ids);
      }
    }

    const laws: LibraryLawRow[] = rawLaws.map((law) => ({
      ...law,
      all_category_ids: filters?.skipEnrichment
        ? law.category_id
          ? [law.category_id]
          : []
        : (catMap.get(law.id) ?? (law.category_id ? [law.category_id] : [])),
      is_linked_shared_law: filters?.skipEnrichment ? false : linkedLawIds.has(law.id),
    }));

    const data: LibraryData = sanitizeLibraryDataForPublic(
      {
        countries: sortCountriesAlphabetically((countriesRes.data ?? []) as LibraryCountry[]),
        categories: (categoriesRes.data ?? []) as LibraryCategory[],
        laws,
        lawCount,
      },
      internalCategoryId
    );

    const isFullUnfilteredCache =
      key === "__initial__" &&
      !filters?.skipEnrichment &&
      !paginated &&
      rowCap >= LAWS_LIMIT;
    if (isFullUnfilteredCache) {
      cachedData = data;
      cacheTimestamp = Date.now();
    }

    return data;
  })();
}

export async function fetchLibraryData(filters?: LibraryFilters): Promise<LibraryData> {
  const resolvedFilters = await resolveLibraryFilterIds(filters);
  const key = cacheKey(resolvedFilters);
  const now = Date.now();
  const supabase = getSupabaseServer();
  const internalCategoryId = await resolveInternalLibraryCategoryId(supabase);

  if (key === "__initial__" && cachedData && now - cacheTimestamp < CACHE_TTL_MS) {
    return sanitizeLibraryDataForPublic(cachedData, internalCategoryId);
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error("Library load timeout")), FETCH_TIMEOUT_MS);
  });

  try {
    const data = await Promise.race([doFetch(resolvedFilters), timeoutPromise]);
    return data;
  } catch (err) {
    // For filtered requests, gracefully degrade to in-memory filtering from the
    // most recent unfiltered cache instead of throwing a 500.
    if (key !== "__initial__" && cachedData) {
      return applyFiltersToCachedData(cachedData, resolvedFilters, internalCategoryId);
    }
    if (key === "__initial__" && cachedData) {
      return sanitizeLibraryDataForPublic(cachedData, internalCategoryId);
    }
    throw err;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

let cachedMeta: Pick<LibraryData, "countries" | "categories"> | null = null;
let metaCacheTimestamp = 0;

/** Countries + categories only (fast path for resolving URL filters without loading all laws). */
export async function fetchLibraryMeta(): Promise<Pick<LibraryData, "countries" | "categories">> {
  const now = Date.now();
  if (cachedMeta && now - metaCacheTimestamp < CACHE_TTL_MS) {
    return cachedMeta;
  }
  const supabase = getSupabaseServer();
  const [countriesRes, categoriesRes] = await Promise.all([
    supabase.from("countries").select("id, name, region").order("name"),
    supabase.from("categories").select("id, name, slug").order("name"),
  ]);
  if (countriesRes.error) throw countriesRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  cachedMeta = {
    countries: sortCountriesAlphabetically((countriesRes.data ?? []) as LibraryCountry[]),
    categories: filterPublicLibraryCategories((categoriesRes.data ?? []) as LibraryCategory[]),
  };
  metaCacheTimestamp = now;
  return cachedMeta;
}
