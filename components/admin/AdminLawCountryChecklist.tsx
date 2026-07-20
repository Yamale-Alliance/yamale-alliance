"use client";

import type { ReactNode } from "react";
import type { LibraryCountry } from "@/lib/library-data";
import { groupLibraryCountries } from "@/lib/library-country-groups";

type AdminLawCountryChecklistProps = {
  countries: LibraryCountry[];
  selectedIds: string[];
  disabled?: boolean;
  /** Assigned countries that must stay selected (edit flow). */
  lockedIds?: string[];
  regionalGroupLabel: string;
  sovereignGroupLabel: string;
  renderItemSuffix?: (country: LibraryCountry) => ReactNode;
  onChange: (ids: string[]) => void;
};

export function AdminLawCountryChecklist({
  countries,
  selectedIds,
  disabled = false,
  lockedIds = [],
  regionalGroupLabel,
  sovereignGroupLabel,
  renderItemSuffix,
  onChange,
}: AdminLawCountryChecklistProps) {
  const { regional, sovereign } = groupLibraryCountries(countries);
  const lockedSet = new Set(lockedIds);

  const toggle = (id: string, checked: boolean) => {
    if (lockedSet.has(id) && !checked) return;
    onChange(
      checked
        ? selectedIds.includes(id)
          ? selectedIds
          : [...selectedIds, id]
        : selectedIds.filter((x) => x !== id)
    );
  };

  const renderGroup = (label: string, items: LibraryCountry[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {items.map((c) => {
          const checked = selectedIds.includes(c.id);
          const isLocked = lockedSet.has(c.id);
          return (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled || isLocked}
                onChange={(e) => toggle(c.id, e.target.checked)}
                className="h-4 w-4 rounded border-input disabled:opacity-60"
              />
              <span className={isLocked ? "text-muted-foreground" : undefined}>
                {c.name}
                {renderItemSuffix?.(c)}
              </span>
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderGroup(regionalGroupLabel, regional)}
      {renderGroup(sovereignGroupLabel, sovereign)}
    </div>
  );
}
