"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Filter, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { LibraryCategory, LibraryCountry } from "@/lib/library-data";

const STATUSES = [
  { value: "In force", key: "inForce" },
  { value: "Amended", key: "amended" },
  { value: "Repealed", key: "repealed" },
] as const;

const DOCUMENT_TYPES = [
  { value: "Law", key: "law" },
  { value: "Decree", key: "decree" },
  { value: "Regulation", key: "regulation" },
  { value: "Code", key: "code" },
  { value: "Directive", key: "directive" },
  { value: "Treaty", key: "treaty" },
  { value: "Agreement", key: "agreement" },
  { value: "Other", key: "other" },
] as const;

const TREATY_FILTERS = [
  { value: "", key: null },
  { value: "Bilateral", key: "bilateral" },
  { value: "Multilateral", key: "multilateral" },
  { value: "Not a treaty", key: "notTreaty" },
] as const;

type SortOption = "title-asc" | "title-desc" | "country" | "category" | "newest";

const SORT_OPTION_KEYS: { value: SortOption; key: string }[] = [
  { value: "title-asc", key: "titleAsc" },
  { value: "title-desc", key: "titleDesc" },
  { value: "country", key: "country" },
  { value: "category", key: "category" },
  { value: "newest", key: "newest" },
];

export type LibraryFiltersBarProps = {
  countries: LibraryCountry[];
  categories: LibraryCategory[];
  categoryNames: string[];
  country: string;
  category: string;
  status: string;
  documentType: string;
  treatyType: string;
  yearFrom: string;
  yearTo: string;
  sortBy: SortOption;
  resultsTotal: number;
  safePage: number;
  totalPages: number;
  hasFilters: boolean;
  filterBadgeCount: number;
  advancedFilterCount: number;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  mobileFiltersOpen: boolean;
  onMobileFiltersOpenChange: (open: boolean) => void;
  onCountryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onDocumentTypeChange: (value: string) => void;
  onTreatyTypeChange: (value: string) => void;
  onYearFromChange: (value: string) => void;
  onYearToChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onClearFilters: () => void;
  bookmarkedCount: number;
  purchasedCount: number;
  isSignedIn: boolean;
};

export function LibraryFiltersBar({
  countries,
  categories,
  categoryNames,
  country,
  category,
  status,
  documentType,
  treatyType,
  yearFrom,
  yearTo,
  sortBy,
  resultsTotal,
  safePage,
  totalPages,
  hasFilters,
  filterBadgeCount,
  advancedFilterCount,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  mobileFiltersOpen,
  onMobileFiltersOpenChange,
  onCountryChange,
  onCategoryChange,
  onStatusChange,
  onDocumentTypeChange,
  onTreatyTypeChange,
  onYearFromChange,
  onYearToChange,
  onSortChange,
  onClearFilters,
  bookmarkedCount,
  purchasedCount,
  isSignedIn,
}: LibraryFiltersBarProps) {
  const t = useTranslations("library");

  const sortOptions = useMemo(
    () =>
      SORT_OPTION_KEYS.map((opt) => ({
        value: opt.value,
        label: t(`sort.${opt.key}`),
      })),
    [t]
  );

  const categoryOptions =
    categories.length > 0
      ? categories.map((c) => ({ key: c.id, name: c.name }))
      : categoryNames.map((name) => ({ key: name, name }));

  const advancedFields = (
    <>
      <select
        value={documentType}
        onChange={(e) => onDocumentTypeChange(e.target.value)}
        aria-label={t("documentType")}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="">{t("allDocumentTypes")}</option>
        {DOCUMENT_TYPES.map((item) => (
          <option key={item.value} value={item.value}>
            {t(`documentTypes.${item.key}`)}
          </option>
        ))}
      </select>
      <select
        value={treatyType}
        onChange={(e) => onTreatyTypeChange(e.target.value)}
        aria-label={t("classification")}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="">{t("allClassifications")}</option>
        {TREATY_FILTERS.filter((item) => item.value).map((item) => (
          <option key={item.value} value={item.value}>
            {t(`treatyTypes.${item.key}`)}
          </option>
        ))}
      </select>
      <input
        type="number"
        inputMode="numeric"
        placeholder={t("yearFrom")}
        aria-label={t("yearFrom")}
        value={yearFrom}
        onChange={(e) => onYearFromChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      <input
        type="number"
        inputMode="numeric"
        placeholder={t("yearTo")}
        aria-label={t("yearTo")}
        value={yearTo}
        onChange={(e) => onYearToChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
    </>
  );

  return (
    <>
      <div className="mt-6 border-y border-border bg-card px-4 py-3 sm:px-8">
        <div className="mx-auto max-w-[1280px] space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onMobileFiltersOpenChange(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground md:hidden"
            >
              <Filter className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {t("filters")}
              {filterBadgeCount > 0 ? (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
                  {filterBadgeCount}
                </span>
              ) : null}
            </button>

            <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-2 md:flex">
              <select
                value={country}
                onChange={(e) => onCountryChange(e.target.value)}
                aria-label={t("country")}
                className="min-w-[10rem] max-w-[14rem] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">{t("allCountries")}</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={category}
                onChange={(e) => onCategoryChange(e.target.value)}
                aria-label={t("category")}
                className="min-w-[10rem] max-w-[14rem] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">{t("allCategories")}</option>
                {categoryOptions.map((c) => (
                  <option key={c.key} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => onStatusChange(e.target.value)}
                aria-label={t("status")}
                className="min-w-[8.5rem] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">{t("allStatuses")}</option>
                {STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(`statuses.${item.key}`)}
                  </option>
                ))}
              </select>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onToggleAdvancedFilters();
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  showAdvancedFilters || advancedFilterCount > 0
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-foreground hover:bg-muted"
                }`}
              >
                {t("more")}{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}
              </button>
            </div>

            <p className="hidden text-xs text-muted-foreground sm:block">
              {totalPages > 0
                ? t("resultsPage", { count: resultsTotal.toLocaleString(), page: safePage, total: totalPages })
                : t("results", { count: resultsTotal.toLocaleString() })}
            </p>

            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              aria-label={t("sortResults")}
              className="ml-auto min-w-[9.5rem] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground sm:ml-0"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {hasFilters ? (
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                title={t("clearAllFilters")}
              >
                <X className="h-4 w-4" aria-hidden />
                <span className="sr-only sm:not-sr-only sm:inline">{t("clear")}</span>
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <p className="sm:hidden">
              {totalPages > 0
                ? t("resultsPageMobile", { count: resultsTotal.toLocaleString(), page: safePage, total: totalPages })
                : t("results", { count: resultsTotal.toLocaleString() })}
            </p>
            {bookmarkedCount > 0 ? (
              <Link href="/library/bookmarks" className="font-medium text-primary hover:underline">
                {t("bookmarks", { count: bookmarkedCount })}
              </Link>
            ) : null}
            {isSignedIn ? (
              <Link href="/library/purchased" className="font-medium text-primary hover:underline">
                {purchasedCount > 0 ? t("purchasedCount", { count: purchasedCount }) : t("purchased")}
              </Link>
            ) : null}
          </div>

          {showAdvancedFilters ? (
            <div className="hidden grid-cols-2 gap-2 border-t border-border/60 pt-2.5 lg:grid lg:grid-cols-4">
              {advancedFields}
            </div>
          ) : null}
        </div>
      </div>

      <Dialog.Root open={mobileFiltersOpen} onOpenChange={onMobileFiltersOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 md:hidden" />
          <Dialog.Content
            className="fixed inset-x-0 bottom-0 z-50 max-h-[min(85vh,32rem)] overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-2xl md:hidden"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <Dialog.Title className="text-base font-semibold text-foreground">{t("filterLaws")}</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  aria-label={t("closeFilters")}
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">{t("country")}</span>
                <select
                  value={country}
                  onChange={(e) => onCountryChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                >
                  <option value="">{t("allCountries")}</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">{t("category")}</span>
                <select
                  value={category}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                >
                  <option value="">{t("allCategories")}</option>
                  {categoryOptions.map((c) => (
                    <option key={c.key} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">{t("status")}</span>
                <select
                  value={status}
                  onChange={(e) => onStatusChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                >
                  <option value="">{t("allStatuses")}</option>
                  {STATUSES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {t(`statuses.${item.key}`)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("moreFilters")}</p>
              <div className="grid grid-cols-2 gap-2">{advancedFields}</div>
            </div>
            <div className="mt-5 flex gap-2 border-t border-border pt-4">
              {hasFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    onClearFilters();
                    onMobileFiltersOpenChange(false);
                  }}
                  className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium"
                >
                  {t("clearAll")}
                </button>
              ) : null}
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  {t("showResults")}
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
