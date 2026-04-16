import { LibraryView } from "./LibraryView";
import { fetchLibraryData } from "@/lib/library-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const country = typeof params.country === "string" ? decodeURIComponent(params.country) : "";
  const category = typeof params.category === "string" ? decodeURIComponent(params.category) : "";
  const status = typeof params.status === "string" ? params.status : "";
  const q = typeof params.q === "string" ? params.q : "";
  const pageParam = typeof params.page === "string" ? params.page : "";
  const sortParam = typeof params.sort === "string" ? params.sort : "";

  // First load countries/categories so we can resolve IDs from names
  const baseData = await fetchLibraryData();
  const countryId = baseData.countries.find((c) => c.name === country)?.id;
  const categoryId = baseData.categories.find((c) => c.name === category)?.id;

  // Then fetch laws using the same filtered query as the /api/laws endpoint
  const filteredData = await fetchLibraryData({
    countryId,
    categoryId,
    status: status || undefined,
    q: q.trim() || undefined,
  });

  return (
    <LibraryView
      initialCountries={baseData.countries}
      initialCategories={baseData.categories}
      initialLaws={filteredData.laws}
      initialLawCount={filteredData.lawCount}
      initialCountry={country}
      initialCategory={category}
      initialStatus={status}
      initialSearch={q}
      initialPage={pageParam}
      initialSort={sortParam}
    />
  );
}
