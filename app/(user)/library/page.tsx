import { Suspense } from "react";
import dynamic from "next/dynamic";
import { auth } from "@clerk/nextjs/server";
import { fetchLibraryData, LIBRARY_PAGE_SIZE, type LibrarySortOption } from "@/lib/library-data";
import LibraryLoading from "./loading";

const LibraryView = dynamic(
  () => import("./LibraryView").then((m) => ({ default: m.LibraryView })),
  { loading: () => <LibraryLoading /> }
);

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type ResolvedLibraryParams = {
  country: string;
  category: string;
  status: string;
  q: string;
  documentType: string;
  classification: string;
  yearFrom: string;
  yearTo: string;
  pageParam: string;
  sortParam: string;
};

const SORT_OPTIONS: LibrarySortOption[] = [
  "title-asc",
  "title-desc",
  "country",
  "category",
  "newest",
];

function parseLibraryPage(s: string): number {
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parseLibrarySort(s: string): LibrarySortOption {
  return SORT_OPTIONS.includes(s as LibrarySortOption) ? (s as LibrarySortOption) : "title-asc";
}

async function resolveLibraryParams(searchParams: SearchParams): Promise<ResolvedLibraryParams> {
  const params = await searchParams;
  return {
    country: typeof params.country === "string" ? decodeURIComponent(params.country) : "",
    category: typeof params.category === "string" ? decodeURIComponent(params.category) : "",
    status: typeof params.status === "string" ? params.status : "",
    q: typeof params.q === "string" ? params.q : "",
    documentType: typeof params.documentType === "string" ? params.documentType : "",
    classification: typeof params.classification === "string" ? params.classification : "",
    yearFrom: typeof params.yearFrom === "string" ? params.yearFrom : "",
    yearTo: typeof params.yearTo === "string" ? params.yearTo : "",
    pageParam: typeof params.page === "string" ? params.page : "",
    sortParam: typeof params.sort === "string" ? params.sort : "",
  };
}

async function LibraryPageContent({ resolved }: { resolved: ResolvedLibraryParams }) {
  const { userId } = await auth();
  if (!userId) return null;

  const {
    country,
    category,
    status,
    q,
    documentType,
    classification,
    yearFrom,
    yearTo,
    pageParam,
    sortParam,
  } = resolved;

  const page = parseLibraryPage(pageParam);
  const sort = parseLibrarySort(sortParam || "title-asc");

  const data = await fetchLibraryData({
    countryName: country || undefined,
    categoryName: category || undefined,
    status: status || undefined,
    q: q.trim() || undefined,
    page,
    pageSize: LIBRARY_PAGE_SIZE,
    sort,
    yearFrom: yearFrom || undefined,
    yearTo: yearTo || undefined,
    treatyType: classification || undefined,
    documentType: documentType || undefined,
  });

  return (
    <LibraryView
      initialCountries={data.countries}
      initialCategories={data.categories}
      initialLaws={data.laws}
      initialLawCount={data.lawCount}
      initialCountry={country}
      initialCategory={category}
      initialStatus={status}
      initialSearch={q}
      initialDocumentType={documentType}
      initialTreatyType={classification}
      initialYearFrom={yearFrom}
      initialYearTo={yearTo}
      initialPage={String(page)}
      initialSort={sort}
    />
  );
}

export default function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<LibraryLoading />}>
      <LibraryPageLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function LibraryPageLoader({ searchParams }: { searchParams: SearchParams }) {
  const resolved = await resolveLibraryParams(searchParams);
  return <LibraryPageContent resolved={resolved} />;
}
