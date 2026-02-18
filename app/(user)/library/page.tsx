import { LibraryView } from "./LibraryView";
import { fetchLibraryData } from "@/lib/library-data";
import type { LibraryLawRow } from "@/lib/library-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function filterLawsByParams(
  laws: LibraryLawRow[],
  country: string,
  category: string,
  status: string,
  q: string
): LibraryLawRow[] {
  if (!country && !category && !status && !q.trim()) return laws;
  return laws.filter((row) => {
    const matchCountry = !country || row.countries?.name === country;
    const matchCategory = !category || row.categories?.name === category;
    const matchStatus = !status || row.status === status;
    const matchQ = !q.trim() || row.title.toLowerCase().includes(q.trim().toLowerCase());
    return matchCountry && matchCategory && matchStatus && matchQ;
  });
}

export default async function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const country = typeof params.country === "string" ? decodeURIComponent(params.country) : "";
  const category = typeof params.category === "string" ? decodeURIComponent(params.category) : "";
  const status = typeof params.status === "string" ? params.status : "";
  const q = typeof params.q === "string" ? params.q : "";

  const { countries, categories, laws } = await fetchLibraryData();
  const filteredLaws = filterLawsByParams(laws, country, category, status, q);

  return (
    <LibraryView
      initialCountries={countries}
      initialCategories={categories}
      initialLaws={filteredLaws}
      initialCountry={country}
      initialCategory={category}
      initialStatus={status}
      initialSearch={q}
    />
  );
}
