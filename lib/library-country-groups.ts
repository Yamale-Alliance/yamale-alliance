import type { LibraryCountry } from "@/lib/library-data";
import { isRegionalBodyCountry, regionalBodySortIndex } from "@/lib/regional-bodies";

export type GroupedLibraryCountries = {
  regional: LibraryCountry[];
  sovereign: LibraryCountry[];
};

/** Split catalog countries into regional bodies vs sovereign states for grouped pickers. */
export function groupLibraryCountries(countries: LibraryCountry[]): GroupedLibraryCountries {
  const regional: LibraryCountry[] = [];
  const sovereign: LibraryCountry[] = [];

  for (const country of countries) {
    if (isRegionalBodyCountry(country)) regional.push(country);
    else sovereign.push(country);
  }

  regional.sort((a, b) => {
    const byCatalog = regionalBodySortIndex(a.code) - regionalBodySortIndex(b.code);
    if (byCatalog !== 0) return byCatalog;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  sovereign.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return { regional, sovereign };
}
