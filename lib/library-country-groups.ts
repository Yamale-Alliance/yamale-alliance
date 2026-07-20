import type { LibraryCountry } from "@/lib/library-data";
import { isRegionalBodyCountry } from "@/lib/regional-bodies";

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

  const collator = (a: LibraryCountry, b: LibraryCountry) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

  regional.sort(collator);
  sovereign.sort(collator);

  return { regional, sovereign };
}
