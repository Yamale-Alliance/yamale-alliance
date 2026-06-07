"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, FileText, Loader2, Trash2, CopyCheck, Trash, History, Download, Scale, Link2, Tags } from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";
import { LAW_TREATY_TYPES, type LawTreatyType } from "@/lib/law-treaty-type";

type Country = { id: string; name: string; region: string | null };
type Category = { id: string; name: string; slug: string | null };
type Law = {
  id: string;
  title: string;
  year: number | null;
  status: string;
  treaty_type?: string | null;
  country_id: string | null;
  applies_to_all_countries?: boolean;
  category_id: string;
  countries: { name: string } | null;
  categories: { name: string } | null;
};

function AdminLawsPageInner() {
  const t = useTranslations("admin.laws.list");
  const tc = useTranslations("admin.common");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const countryId = searchParams.get("countryId") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const status = searchParams.get("status") ?? "";
  const currentListUrl = (() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  const setFilter = useCallback(
    (key: "countryId" | "categoryId" | "status", value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [laws, setLaws] = useState<Law[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dupLoading, setDupLoading] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const [dupSummary, setDupSummary] = useState<{ groups: number; laws: number } | null>(null);
  const [exportScope, setExportScope] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const [bulkTreatyType, setBulkTreatyType] = useState<LawTreatyType>("Multilateral");
  const [bulkTreatySaving, setBulkTreatySaving] = useState(false);
  const [bulkTreatyError, setBulkTreatyError] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const { confirm, confirmDialog } = useConfirm();

  const loadLaws = useCallback(() => {
    const params = new URLSearchParams();
    params.set("skipEnrichment", "1");
    if (countryId) params.set("countryId", countryId);
    if (categoryId) params.set("categoryId", categoryId);
    if (status) params.set("status", status);
    setLoading(true);
    setDeleteError(null);
    setBulkTreatyError(null);
    return fetch(`${window.location.origin}/api/laws?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCountries(data.countries ?? []);
        setCategories(data.categories ?? []);
        setLaws(data.laws ?? []);
      })
      .catch(() => {
        setCountries([]);
        setCategories([]);
        setLaws([]);
      })
      .finally(() => setLoading(false));
  }, [countryId, categoryId, status]);

  useEffect(() => {
    void loadLaws();
  }, [loadLaws]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [countryId, categoryId, status]);

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    const n = laws.filter((l) => selectedIds.has(l.id)).length;
    el.indeterminate = n > 0 && n < laws.length;
  }, [laws, selectedIds]);

  const allVisibleSelected = laws.length > 0 && laws.every((l) => selectedIds.has(l.id));
  const selectedCount = selectedIds.size;

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        laws.forEach((l) => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        laws.forEach((l) => next.add(l.id));
        return next;
      });
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkTreatyType = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: t("confirm.updateTreatyTitle"),
      description: t("confirm.updateTreatyDescription", { treatyType: bulkTreatyType, count: ids.length }),
      confirmLabel: t("confirm.update"),
      cancelLabel: tc("cancel"),
    });
    if (!ok) return;
    setBulkTreatySaving(true);
    setBulkTreatyError(null);
    try {
      const res = await fetch("/api/admin/laws/batch-update", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, treaty_type: bulkTreatyType }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        updated?: number;
      };
      if (!res.ok) {
        setBulkTreatyError(typeof data.error === "string" ? data.error : t("errors.updateFailed"));
        return;
      }
      setSelectedIds(new Set());
      await loadLaws();
    } catch {
      setBulkTreatyError(tc("networkError"));
    } finally {
      setBulkTreatySaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: t("confirm.deleteTitle"),
      description: t("confirm.deleteDescription", { count: ids.length }),
      confirmLabel: t("confirm.delete"),
      cancelLabel: tc("cancel"),
      variant: "destructive",
    });
    if (!ok) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/admin/laws/batch-delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; deleted?: number };
      if (!res.ok) {
        setDeleteError(typeof data.error === "string" ? data.error : t("errors.deleteFailed"));
        return;
      }
      setSelectedIds(new Set());
      await loadLaws();
    } catch {
      setDeleteError(tc("networkError"));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (exportScope !== "all") params.set("region", exportScope);
      const response = await fetch(`/api/admin/laws/export?${params.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) throw new Error(t("errors.exportFailed"));
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileNameFromHeader = response.headers
        .get("content-disposition")
        ?.match(/filename="([^"]+)"/)?.[1];
      link.href = downloadUrl;
      link.download = fileNameFromHeader ?? t("export.defaultFilename");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch {
      window.alert(t("errors.exportAlert"));
    } finally {
      setExporting(false);
    }
  };

  const availableRegions = Array.from(
    new Set(
      countries
        .map((c) => (c.region ?? "").trim().replace(/\s+/g, " "))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  return (
    <div className="p-4 sm:p-6">
      {confirmDialog}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin-panel/laws/fix-ocr"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t("actions.fixOcr")}
          </Link>
          <Link
            href="/admin-panel/laws/link-by-title"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Link2 className="h-4 w-4" />
            {t("actions.linkByTitle")}
          </Link>
          <Link
            href="/admin-panel/laws/linked"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Link2 className="h-4 w-4" />
            {t("actions.linkedLaws")}
          </Link>
          <Link
            href="/admin-panel/laws/categories"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Tags className="h-4 w-4" />
            {t("actions.categories")}
          </Link>
          <Link
            href={`/admin-panel/laws/deleted?returnTo=${encodeURIComponent(currentListUrl)}`}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Trash className="h-4 w-4" />
            {t("actions.recentlyDeleted")}
          </Link>
          <Link
            href="/admin-panel/laws/updated"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <History className="h-4 w-4" />
            {t("actions.recentlyUpdated")}
          </Link>
          <Link
            href="/admin-panel/laws/add"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {t("actions.addLaw")}
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("filters.country")}</label>
          <select
            value={countryId}
            onChange={(e) => setFilter("countryId", e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{tc("all")}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("filters.category")}</label>
          <select
            value={categoryId}
            onChange={(e) => setFilter("categoryId", e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{tc("all")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{tc("status")}</label>
          <select
            value={status}
            onChange={(e) => setFilter("status", e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{tc("all")}</option>
            <option value="In force">{t("statusValues.inForce")}</option>
            <option value="Amended">{t("statusValues.amended")}</option>
            <option value="Repealed">{t("statusValues.repealed")}</option>
          </select>
        </div>
        <div className="self-end">
          <button
            type="button"
            onClick={() => {
              setFilter("countryId", "");
              setFilter("categoryId", "");
              setFilter("status", "");
            }}
            disabled={!countryId && !categoryId && !status}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
          >
            {t("filters.clear")}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!categoryId) return;
            setDupLoading(true);
            setDupError(null);
            setDupSummary(null);
            const params = new URLSearchParams();
            params.set("categoryId", categoryId);
            fetch(`/api/admin/laws/duplicates?${params.toString()}`, { credentials: "include" })
              .then((r) => r.json())
              .then((data) => {
                if (!data?.ok) {
                  setDupError(
                    typeof data.error === "string" ? data.error : t("duplicates.error")
                  );
                  setDupSummary(null);
                  return;
                }
                const groups = Array.isArray(data.duplicates) ? data.duplicates : [];
                const lawsCount = groups.reduce(
                  (sum: number, g: { laws?: unknown[] }) => sum + (Array.isArray(g.laws) ? g.laws.length : 0),
                  0
                );
                setDupSummary({ groups: groups.length, laws: lawsCount });
              })
              .catch(() => {
                setDupError(t("duplicates.error"));
                setDupSummary(null);
              })
              .finally(() => setDupLoading(false));
          }}
          disabled={!categoryId || dupLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
        >
          {dupLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CopyCheck className="h-3.5 w-3.5" />
          )}
          {dupLoading ? t("duplicates.checking") : t("duplicates.checkAction")}
        </button>
        {!categoryId ? (
          <span className="text-xs text-muted-foreground">
            {t("duplicates.selectCategoryHint")}
          </span>
        ) : dupError ? (
          <span className="text-xs text-destructive">{dupError}</span>
        ) : dupSummary ? (
          dupSummary.groups > 0 ? (
            <span className="text-xs text-muted-foreground">
              {t("duplicates.found", { groups: dupSummary.groups, laws: dupSummary.laws })}{" "}
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("categoryId", categoryId);
                  params.set("returnTo", currentListUrl);
                  router.push(`/admin-panel/laws/duplicates?${params.toString()}`);
                }}
                className="text-primary underline-offset-2 hover:underline"
              >
                {t("duplicates.viewDetails")}
              </button>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("duplicates.noneFound")}</span>
          )
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("export.region")}</label>
          <select
            value={exportScope}
            onChange={(e) => setExportScope(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">{t("export.allRegions")}</option>
            {availableRegions.map((region) => (
              <option key={region} value={region}>
                {t("export.regionOnly", { region })}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? t("export.exporting") : t("export.exportButton")}
        </button>
      </div>

      {!loading && laws.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("bulk.treatyTypeLabel")}</label>
              <select
                value={bulkTreatyType}
                onChange={(e) => setBulkTreatyType(e.target.value as LawTreatyType)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {LAW_TREATY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void handleBulkTreatyType()}
              disabled={selectedCount === 0 || bulkTreatySaving}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              {bulkTreatySaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Scale className="h-4 w-4" />
              )}
              {t("bulk.applySelected", { count: selectedCount })}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleDeleteSelected()}
            disabled={selectedCount === 0 || deleting}
            className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/15 disabled:pointer-events-none disabled:opacity-50 sm:ml-auto"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {t("bulk.deleteSelected", { count: selectedCount })}
          </button>
          {(bulkTreatyError || deleteError) && (
            <span className="text-sm text-destructive w-full sm:w-auto">
              {bulkTreatyError ?? deleteError}
            </span>
          )}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : laws.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mb-2 opacity-50" />
            <p>{t("empty")}</p>
            <Link href="/admin-panel/laws/add" className="mt-2 text-sm text-primary hover:underline">
              {t("emptyAddFirst")}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="w-10 p-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 rounded border-input"
                      aria-label={t("table.selectAllAria")}
                    />
                  </th>
                  <th className="text-left p-3 font-medium">{t("table.title")}</th>
                  <th className="text-left p-3 font-medium">{t("table.country")}</th>
                  <th className="text-left p-3 font-medium">{t("table.category")}</th>
                  <th className="text-left p-3 font-medium">{t("table.treaty")}</th>
                  <th className="text-left p-3 font-medium">{tc("status")}</th>
                  <th className="text-left p-3 font-medium">{t("table.year")}</th>
                </tr>
              </thead>
              <tbody>
                {laws.map((law) => (
                  <tr key={law.id} className="border-b border-border hover:bg-muted/30">
                    <td className="p-3 align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(law.id)}
                        onChange={() => toggleRow(law.id)}
                        className="h-4 w-4 rounded border-input"
                        aria-label={`Select ${law.title}`}
                      />
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/admin-panel/laws/${law.id}?returnTo=${encodeURIComponent(currentListUrl)}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {law.title}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {law.applies_to_all_countries ? t("allCountries") : law.countries?.name ?? "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">{law.categories?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{law.treaty_type ?? "—"}</td>
                    <td className="p-3">{law.status}</td>
                    <td className="p-3">{law.year ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminLawsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AdminLawsPageInner />
    </Suspense>
  );
}
