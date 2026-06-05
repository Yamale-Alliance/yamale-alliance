import { NextRequest, NextResponse } from "next/server";
import {
  fetchLibraryData,
  LIBRARY_PAGE_SIZE,
  type LibrarySortOption,
} from "@/lib/library-data";
import { requireLibraryApiSession } from "@/lib/library-api-auth";

const SORT_OPTIONS: LibrarySortOption[] = [
  "title-asc",
  "title-desc",
  "country",
  "category",
  "newest",
];

function parsePage(raw: string | null): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parsePageSize(raw: string | null): number {
  const n = Number.parseInt(raw ?? String(LIBRARY_PAGE_SIZE), 10);
  if (!Number.isFinite(n) || n < 1) return LIBRARY_PAGE_SIZE;
  return Math.min(n, 100);
}

function parseSort(raw: string | null): LibrarySortOption | undefined {
  if (!raw) return undefined;
  return SORT_OPTIONS.includes(raw as LibrarySortOption) ? (raw as LibrarySortOption) : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireLibraryApiSession();
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const metaOnly = searchParams.get("metaOnly") === "1";
    const countryId = searchParams.get("countryId") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const q = searchParams.get("q") ?? undefined;
    const skipEnrichment = searchParams.get("skipEnrichment") === "1";
    const paginate = searchParams.has("page") || searchParams.has("pageSize");

    const page = parsePage(searchParams.get("page"));
    const pageSize = parsePageSize(searchParams.get("pageSize"));
    const sort = parseSort(searchParams.get("sort"));
    const yearFrom = searchParams.get("yearFrom") ?? undefined;
    const yearTo = searchParams.get("yearTo") ?? undefined;
    const treatyType = searchParams.get("treatyType") ?? searchParams.get("classification") ?? undefined;
    const documentType = searchParams.get("documentType") ?? undefined;

    const data = await fetchLibraryData({
      countryId,
      categoryId,
      status,
      q: q ?? undefined,
      skipEnrichment,
      ...(paginate
        ? {
            page,
            pageSize,
            sort,
            yearFrom: yearFrom || undefined,
            yearTo: yearTo || undefined,
            treatyType: treatyType || undefined,
            documentType: documentType || undefined,
          }
        : {}),
    });

    return NextResponse.json({
      countries: data.countries,
      categories: data.categories,
      laws: metaOnly ? [] : data.laws,
      lawCount: data.lawCount,
      ...(paginate ? { page, pageSize } : {}),
    });
  } catch (err) {
    console.error("Laws API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch laws" },
      { status: 500 }
    );
  }
}
