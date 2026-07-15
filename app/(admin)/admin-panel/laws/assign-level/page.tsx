"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Landmark,
  Loader2,
  Map,
  Search,
} from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";
import { DEFAULT_LAW_LEVEL, LAW_LEVELS, type LawLevel } from "@/lib/law-level";

type Country = { id: string; name: string };
type Category = { id: string; name: string };
type LawRow = {
  id: string;
  title: string;
  year: number | null;
  level?: string | null;
  countries: { name: string } | null;
  categories: { name: string } | null;
  applies_to_all_countries?: boolean;
};

const PAGE_SIZE = 40;
const BATCH_CHUNK = 400;

const LEVEL_META: Record<
  LawLevel,
  { icon: typeof Landmark; tone: string; ring: string; key: "national" | "regional" | "international" }
> = {
  National: {
    icon: Landmark,
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
    ring: "ring-emerald-500/50",
    key: "national",
  },
  Regional: {
    icon: Map,
    tone: "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-100",
    ring: "ring-sky-500/50",
    key: "regional",
  },
  International: {
    icon: Globe2,
    tone: "border-violet-500/40 bg-violet-500/10 text-violet-900 dark:text-violet-100",
    ring: "ring-violet-500/50",
    key: "international",
  },
};

function levelKey(level: string | null | undefined): "national" | "regional" | "international" | null {
  if (level === "National") return "national";
  if (level === "Regional") return "regional";
  if (level === "International") return "international";
  return null;
}

export default function AdminAssignLevelPage() {
  const t = useTranslations("admin.laws.assignLevel");
  const tc = useTranslations("admin.common");
  const { confirm, confirmDialog } = useConfirm();

  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countryId, setCountryId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [laws, setLaws] = useState<LawRow[]>([]);
  const [lawCount, setLawCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);
  const [targetLevel, setTargetLevel] = useState<LawLevel>(DEFAULT_LAW_LEVEL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(lawCount / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const selectedCount = selectAllFiltered ? lawCount : selectedIds.size;
  const pageIds = useMemo(() => laws.map((l) => l.id), [laws]);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.set("skipEnrichment", "1");
    params.set("page", String(safePage));
    params.set("pageSize", String(PAGE_SIZE));
    if (countryId) params.set("countryId", countryId);
    if (categoryId) params.set("categoryId", categoryId);
    if (q.trim()) params.set("q", q.trim());
    setLoading(true);
    setError(null);
    return fetch(`/api/laws?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCountries(data.countries ?? []);
        setCategories(data.categories ?? []);
        setLaws(data.laws ?? []);
        setLawCount(typeof data.lawCount === "number" ? data.lawCount : (data.laws ?? []).length);
      })
      .catch(() => {
        setCountries([]);
        setCategories([]);
        setLaws([]);
        setLawCount(0);
        setError(t("errors.loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [countryId, categoryId, q, safePage, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchDraft.trim());
      setPage(1);
      setSelectedIds(new Set());
      setSelectAllFiltered(false);
      setSuccess(null);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const resetSelection = () => {
    setSelectedIds(new Set());
    setSelectAllFiltered(false);
    setSuccess(null);
  };

  const setCountryFilter = (value: string) => {
    setCountryId(value);
    setPage(1);
    resetSelection();
  };

  const setCategoryFilter = (value: string) => {
    setCategoryId(value);
    setPage(1);
    resetSelection();
  };

  const toggleOne = (id: string) => {
    setSelectAllFiltered(false);
    setSuccess(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelectAllFiltered(false);
    setSuccess(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  };

  const selectEntireFilteredSet = () => {
    if (lawCount === 0) return;
    setSelectAllFiltered(true);
    setSelectedIds(new Set(pageIds));
    setSuccess(null);
  };

  const clearSelection = () => {
    resetSelection();
  };

  const fetchAllMatchingIds = async (): Promise<string[]> => {
    const ids: string[] = [];
    let pageIndex = 1;
    const maxPages = Math.ceil(lawCount / 100) + 2;
    while (pageIndex <= maxPages) {
      const params = new URLSearchParams();
      params.set("skipEnrichment", "1");
      params.set("page", String(pageIndex));
      params.set("pageSize", "100");
      if (countryId) params.set("countryId", countryId);
      if (categoryId) params.set("categoryId", categoryId);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/laws?${params}`, { credentials: "include" });
      const data = (await res.json()) as { laws?: LawRow[]; lawCount?: number };
      if (!res.ok) throw new Error(t("errors.loadFailed"));
      const batch = data.laws ?? [];
      ids.push(...batch.map((l) => l.id));
      const total = typeof data.lawCount === "number" ? data.lawCount : ids.length;
      if (batch.length === 0 || ids.length >= total) break;
      pageIndex += 1;
    }
    return [...new Set(ids)];
  };

  const applyLevelInChunks = async (ids: string[]) => {
    let updated = 0;
    for (let i = 0; i < ids.length; i += BATCH_CHUNK) {
      const chunk = ids.slice(i, i + BATCH_CHUNK);
      const res = await fetch("/api/admin/laws/batch-update", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: chunk, level: targetLevel }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        updated?: number;
      };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : t("errors.updateFailed"));
      }
      updated += typeof data.updated === "number" ? data.updated : chunk.length;
    }
    return updated;
  };

  const handleApply = async () => {
    if (selectedCount === 0) return;
    const levelLabel = t(`levels.${LEVEL_META[targetLevel].key}`);
    const ok = await confirm({
      title: t("confirm.title"),
      description: selectAllFiltered
        ? t("confirm.applyAllFiltered", { level: levelLabel, count: lawCount })
        : t("confirm.applySelected", { level: levelLabel, count: selectedIds.size }),
      confirmLabel: t("confirm.apply"),
      cancelLabel: tc("cancel"),
    });
    if (!ok) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const ids = selectAllFiltered ? await fetchAllMatchingIds() : Array.from(selectedIds);
      if (ids.length === 0) {
        setError(t("errors.noneSelected"));
        return;
      }
      const updated = await applyLevelInChunks(ids);
      setSuccess(t("success", { count: updated, level: levelLabel }));
      resetSelection();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-muted/40 via-background to-background">
      {confirmDialog}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/admin-panel/laws"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>

        <header className="mt-4 max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{t("title")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("subtitle")}</p>
        </header>

        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { step: 1, label: t("steps.filter") },
            { step: 2, label: t("steps.assign") },
            { step: 3, label: t("steps.select") },
          ].map((item) => (
            <li
              key={item.step}
              className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/80 px-4 py-3 shadow-sm"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {item.step}
              </span>
              <span className="text-sm font-medium text-foreground">{item.label}</span>
            </li>
          ))}
        </ol>

        <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-foreground">{t("filterHeading")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("filterHint")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("country")}</span>
              <select
                value={countryId}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              >
                <option value="">{t("allCountries")}</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("category")}</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              >
                <option value="">{t("allCategories")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 sm:col-span-2 lg:col-span-1">
              <span className="text-xs font-medium text-muted-foreground">{t("search")}</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm"
                />
              </span>
            </label>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-foreground">{t("assignHeading")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("assignHint")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {LAW_LEVELS.map((level) => {
              const meta = LEVEL_META[level];
              const Icon = meta.icon;
              const active = targetLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setTargetLevel(level)}
                  className={`rounded-2xl border px-3 py-3 text-left transition sm:px-4 sm:py-4 ${meta.tone} ${
                    active ? `ring-2 ${meta.ring}` : "opacity-80 hover:opacity-100"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="mt-2 block text-sm font-semibold sm:mt-3 sm:text-base">{t(`levels.${meta.key}`)}</span>
                  <span className="mt-1 hidden text-xs opacity-80 sm:block">{t(`levelHints.${meta.key}`)}</span>
                  {active ? (
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold">
                      <Check className="h-3.5 w-3.5" />
                      {t("selectedLevel")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {(error || success) && (
            <p className={`mt-4 text-sm ${error ? "text-destructive" : "text-emerald-700 dark:text-emerald-300"}`}>
              {error ?? success}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={selectedCount === 0 || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("applyButton", { count: selectedCount })}
            </button>
            <span className="text-xs text-muted-foreground">{t("applyNote")}</span>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t("resultsHeading")}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("resultsMeta", { count: lawCount, selected: selectedCount })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={togglePage}
                disabled={loading || laws.length === 0}
                className="rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                {allPageSelected ? t("deselectPage") : t("selectPage")}
              </button>
              <button
                type="button"
                onClick={selectEntireFilteredSet}
                disabled={loading || lawCount === 0}
                className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
              >
                {t("selectAllFiltered", { count: lawCount })}
              </button>
              {selectedCount > 0 ? (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-lg border border-input px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
                >
                  {t("clearSelection")}
                </button>
              ) : null}
              {selectedCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void handleApply()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t("applyButton", { count: selectedCount })}
                </button>
              ) : null}
            </div>
          </div>

          {selectAllFiltered ? (
            <div className="border-b border-primary/20 bg-primary/5 px-4 py-2.5 text-xs font-medium text-primary sm:px-5">
              {t("allFilteredSelected", { count: lawCount })}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : laws.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-muted-foreground sm:px-5">{t("empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {laws.map((law) => {
                const checked = selectAllFiltered || selectedIds.has(law.id);
                const currentKey = levelKey(law.level);
                return (
                  <li key={law.id}>
                    <label className="flex cursor-pointer gap-3 px-4 py-3.5 transition hover:bg-muted/40 sm:px-5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(law.id)}
                        className="mt-1 h-4 w-4 rounded border-input"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug text-foreground">
                          {law.title}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {law.applies_to_all_countries
                              ? t("allCountries")
                              : (law.countries?.name ?? "—")}
                          </span>
                          <span aria-hidden>·</span>
                          <span>{law.categories?.name ?? "—"}</span>
                          {law.year != null ? (
                            <>
                              <span aria-hidden>·</span>
                              <span>{law.year}</span>
                            </>
                          ) : null}
                        </span>
                      </span>
                      <span
                        className={`h-fit shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          currentKey
                            ? LEVEL_META[
                                currentKey === "national"
                                  ? "National"
                                  : currentKey === "regional"
                                    ? "Regional"
                                    : "International"
                              ].tone
                            : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        {currentKey ? t(`levels.${currentKey}`) : t("levels.unset")}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {lawCount > PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
              <span className="text-xs text-muted-foreground">
                {t("pagination", { page: safePage, totalPages })}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-input hover:bg-accent disabled:opacity-50"
                  aria-label={t("prevPage")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-input hover:bg-accent disabled:opacity-50"
                  aria-label={t("nextPage")}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </section>

      </div>
    </div>
  );
}
