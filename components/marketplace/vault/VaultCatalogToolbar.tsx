"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { VAULT_BROWSE_FREE } from "@/lib/marketplace-vault-categories";

type TopicId = "general" | "afcftaTrade" | "tax" | "labour" | "mining" | "compliance" | "corporate";

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
  showFreeSeries?: boolean;
  freeSeriesLinks?: { id: string; label: string; href: string; active: boolean; count: number }[];
  allFreeHref?: string;
  allFreeActive?: boolean;
  allFreeCount?: number;
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
  showFreeSeries,
  freeSeriesLinks,
  allFreeHref,
  allFreeActive,
  allFreeCount,
}: VaultCatalogToolbarProps) {
  const t = useTranslations("marketplace");

  return (
    <div className="border-b border-border bg-card">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href={clearHref}
              scroll={false}
              className="text-sm font-medium text-[#9a632a] hover:underline"
            >
              {t("landing.backToBrowse")}
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("landing.showingCount", { count: resultCount })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="vault-catalog-sort">
              {t("sort")}
            </label>
            <select
              id="vault-catalog-sort"
              value={vaultSort}
              onChange={(e) => onSortChange(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[#C8922A]"
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
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[#C8922A]"
            >
              {topicOptions.map((topic) => (
                <option key={topic} value={topic}>
                  {topicLabel(topic)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-10 text-sm text-foreground outline-none transition focus:border-[#C8922A]"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("landing.clearSearch")}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {showFreeSeries && freeSeriesLinks && allFreeHref ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={allFreeHref}
              scroll={false}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                allFreeActive
                  ? "bg-[#C8922A] text-white"
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
                    ? "bg-[#C8922A] text-white"
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
  );
}
