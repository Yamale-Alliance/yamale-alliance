"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { VAULT_BROWSE_FREE, VAULT_BROWSE_SERIES } from "@/lib/marketplace-vault-categories";

type TopicId = "general" | "tax" | "labour" | "mining" | "compliance" | "corporate";

export type VaultBrowseTabParam =
  | "all"
  | "course"
  | "template"
  | "guidebook"
  | typeof VAULT_BROWSE_SERIES
  | typeof VAULT_BROWSE_FREE;

type VaultCatalogToolbarProps = {
  title: string;
  resultCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  vaultSort: string;
  onSortChange: (sort: string) => void;
  sortOptions: { value: string; label: string }[];
  selectedTopic: "all" | TopicId;
  onTopicChange: (topic: "all" | TopicId) => void;
  topicOptions: Array<"all" | TopicId>;
  topicLabel: (topic: "all" | TopicId) => string;
  clearHref: string;
  tabs: { param: VaultBrowseTabParam; label: string }[];
  activeTab: VaultBrowseTabParam;
  onTabChange: (param: VaultBrowseTabParam) => void;
  showFreeSeries?: boolean;
  freeSeriesLinks?: { id: string; label: string; href: string; active: boolean; count: number }[];
  allFreeHref?: string;
  allFreeActive?: boolean;
  allFreeCount?: number;
  /** Hide sort/topic controls (catalog “All” overview). */
  showFilterControls?: boolean;
};

export function VaultCatalogToolbar({
  title,
  resultCount,
  search,
  onSearchChange,
  vaultSort,
  onSortChange,
  sortOptions,
  selectedTopic,
  onTopicChange,
  topicOptions,
  topicLabel,
  clearHref,
  tabs,
  activeTab,
  onTabChange,
  showFreeSeries,
  freeSeriesLinks,
  allFreeHref,
  allFreeActive,
  allFreeCount,
  showFilterControls = true,
}: VaultCatalogToolbarProps) {
  const t = useTranslations("marketplace");

  return (
    <div>
      {/* Fixed navy so tabs stay readable in dark mode */}
      <div className="bg-[color:var(--brand-navy-fixed)] text-white">
        <div className="mx-auto max-w-[1140px] px-6 pt-6">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link
              href={clearHref}
              scroll={false}
              className="shrink-0 text-[0.86rem] font-bold text-[color:var(--brand-pale-gold)]/90 transition hover:text-[color:var(--brand-pale-gold)]"
            >
              {t("landing.backToVaultHome")}
            </Link>
            <h1 className="heading shrink-0 text-[1.25rem] font-bold text-white sm:text-[1.4rem]">
              {title}
            </h1>
            <div className="relative ml-auto flex w-full min-w-[200px] max-w-[340px] flex-1 items-center gap-2 rounded-[10px] bg-white py-0.5 pl-3.5 pr-2 sm:w-auto">
              <Search className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand-copper)]" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-[color:var(--brand-navy-fixed)] outline-none placeholder:text-muted-foreground"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="text-muted-foreground hover:text-[color:var(--brand-navy-fixed)]"
                  aria-label={t("landing.clearSearch")}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Scroll wrapper — padding keeps tab labels + underline fully visible */}
          <nav
            className="mt-5 flex gap-5 overflow-x-auto pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={t("landing.browseTitle")}
          >
            {tabs.map((tab) => {
              const on = tab.param === activeTab;
              return (
                <button
                  key={tab.param}
                  type="button"
                  onClick={() => onTabChange(tab.param)}
                  className={`shrink-0 whitespace-nowrap border-b-2 px-0.5 pb-3 pt-1 text-[0.88rem] transition ${
                    on
                      ? "border-[color:var(--primary)] font-bold text-[color:var(--brand-pale-gold)]"
                      : "border-transparent text-white/55 hover:text-white/90"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="vault-catalog-browse">
        <div className="mx-auto max-w-[1140px] space-y-4 px-6 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.82rem] text-[color:var(--brand-copper)]">
            {t("landing.showingCount", { count: resultCount })}
          </p>
          {showFilterControls ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="vault-catalog-sort">
                {t("sort")}
              </label>
              <select
                id="vault-catalog-sort"
                value={vaultSort}
                onChange={(e) => onSortChange(e.target.value)}
                className="rounded-lg border border-[color:var(--border)] bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-[color:var(--primary)]"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="vault-catalog-topic">
                {t("topic")}
              </label>
              <select
                id="vault-catalog-topic"
                value={selectedTopic}
                onChange={(e) => onTopicChange(e.target.value as "all" | TopicId)}
                className="rounded-lg border border-[color:var(--border)] bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-[color:var(--primary)]"
              >
                {topicOptions.map((topic) => (
                  <option key={topic} value={topic}>
                    {topicLabel(topic)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {showFreeSeries && freeSeriesLinks && allFreeHref ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={allFreeHref}
              scroll={false}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                allFreeActive
                  ? "bg-[color:var(--primary)] text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("allFree")}
              {allFreeCount && allFreeCount > 0 ? ` (${allFreeCount})` : ""}
            </Link>
            {freeSeriesLinks.map((series) => (
              <Link
                key={series.id}
                href={series.href}
                scroll={false}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  series.active
                    ? "bg-[color:var(--primary)] text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {series.label}
                {series.count > 0 ? ` (${series.count})` : ""}
              </Link>
            ))}
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
