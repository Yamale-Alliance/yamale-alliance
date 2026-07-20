"use client";

import type { LibraryCountry } from "@/lib/library-data";
import { groupLibraryCountries } from "@/lib/library-country-groups";

type LibraryCountrySelectOptionsProps = {
  countries: LibraryCountry[];
  allLabel: string;
  regionalGroupLabel: string;
  sovereignGroupLabel: string;
  valueField?: "name" | "id";
};

/** Grouped `<option>` lists for library / admin country `<select>` elements. */
export function LibraryCountrySelectOptions({
  countries,
  allLabel,
  regionalGroupLabel,
  sovereignGroupLabel,
  valueField = "name",
}: LibraryCountrySelectOptionsProps) {
  const { regional, sovereign } = groupLibraryCountries(countries);
  const valueOf = (c: LibraryCountry) => (valueField === "id" ? c.id : c.name);

  return (
    <>
      <option value="">{allLabel}</option>
      {regional.length > 0 ? (
        <optgroup label={regionalGroupLabel}>
          {regional.map((c) => (
            <option key={c.id} value={valueOf(c)}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      <optgroup label={sovereignGroupLabel}>
        {sovereign.map((c) => (
          <option key={c.id} value={valueOf(c)}>
            {c.name}
          </option>
        ))}
      </optgroup>
    </>
  );
}
