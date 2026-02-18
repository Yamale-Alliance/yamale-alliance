import { LibraryView } from "./LibraryView";
import { fetchLibraryData } from "@/lib/library-data";

export default async function LibraryPage() {
  const { countries, categories, laws } = await fetchLibraryData();
  return (
    <LibraryView
      initialCountries={countries}
      initialCategories={categories}
      initialLaws={laws}
    />
  );
}
