import { Suspense } from "react";
import { LibraryView } from "./LibraryView";
import { fetchLibraryData } from "@/lib/library-data";
import LibraryLoading from "./loading";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const country = typeof params.country === "string" ? decodeURIComponent(params.country) : "";
  const category = typeof params.category === "string" ? decodeURIComponent(params.category) : "";
  const status = typeof params.status === "string" ? params.status : "";
  const q = typeof params.q === "string" ? params.q : "";
  const documentType = typeof params.documentType === "string" ? params.documentType : "";
  const classification = typeof params.classification === "string" ? params.classification : "";
  const yearFrom = typeof params.yearFrom === "string" ? params.yearFrom : "";
  const yearTo = typeof params.yearTo === "string" ? params.yearTo : "";
  const pageParam = typeof params.page === "string" ? params.page : "";
  const sortParam = typeof params.sort === "string" ? params.sort : "";

  // One catalog fetch (countries/categories + laws). Search text (`q`) is applied client-side
  // so typing in the search box does not trigger a full server round-trip per keystroke.
  const catalog = await fetchLibraryData();
  const countryId = country ? catalog.countries.find((c) => c.name === country)?.id : undefined;
  const categoryId = category ? catalog.categories.find((c) => c.name === category)?.id : undefined;
  const hasListFilters = !!(countryId || categoryId || status);
  const listData = hasListFilters
    ? await fetchLibraryData({
        countryId,
        categoryId,
        status: status || undefined,
      })
    : catalog;

  return (
    <Suspense fallback={<LibraryLoading />}>
      <LibraryView
        initialCountries={catalog.countries}
        initialCategories={catalog.categories}
        initialLaws={listData.laws}
        initialLawCount={listData.lawCount}
        initialCountry={country}
        initialCategory={category}
        initialStatus={status}
        initialSearch={q}
        initialDocumentType={documentType}
        initialTreatyType={classification}
        initialYearFrom={yearFrom}
        initialYearTo={yearTo}
        initialPage={pageParam}
        initialSort={sortParam}
      />
    </Suspense>
  );
}
