"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";

type RagLaw = {
  id: string;
  title: string;
  year: number | null;
  status: string;
  rag_approval_status: string | null;
  ingested_by: string | null;
  ingested_at: string | null;
  content_hash: string | null;
  countries: { name: string } | null;
  categories: { name: string } | null;
};

const PAGE_SIZE = 25;

export default function AdminLawRagApprovalPage() {
  const t = useTranslations("admin.laws.ragApproval");
  const tc = useTranslations("admin.common");
  const [laws, setLaws] = useState<RagLaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [acting, setActing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "all">("pending");
  const selectAllRef = useRef<HTMLInputElement>(null);
  const { confirm, confirmDialog } = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setWarning(null);
    const offset = (page - 1) * PAGE_SIZE;
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      status: statusFilter,
    });
    fetch(`/api/admin/laws/rag-approval?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.error === "string") {
          setError(data.error);
          setLaws([]);
          setTotal(0);
          return;
        }
        setLaws(Array.isArray(data.laws) ? data.laws : []);
        setTotal(typeof data.total === "number" ? data.total : 0);
        setWarning(typeof data.warning === "string" ? data.warning : null);
      })
      .catch(() => {
        setError(t("errors.loadFailed"));
        setLaws([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, statusFilter, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, statusFilter]);

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    const n = laws.filter((l) => selectedIds.has(l.id)).length;
    el.indeterminate = n > 0 && n < laws.length;
  }, [laws, selectedIds]);

  const allVisibleSelected = laws.length > 0 && laws.every((l) => selectedIds.has(l.id));
  const selectedCount = selectedIds.size;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

  const setApproval = async (ids: string[], status: "approved" | "pending") => {
    if (ids.length === 0) return;
    const isApprove = status === "approved";
    const ok = await confirm({
      title: isApprove ? t("confirm.approveTitle") : t("confirm.revokeTitle"),
      description: isApprove
        ? t("confirm.approveDescription", { count: ids.length })
        : t("confirm.revokeDescription", { count: ids.length }),
      confirmLabel: isApprove ? t("confirm.approve") : t("confirm.revoke"),
      cancelLabel: tc("cancel"),
      variant: isApprove ? "default" : "destructive",
    });
    if (!ok) return;

    setActing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/laws/rag-approval", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; updated?: number };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t("errors.updateFailed"));
        return;
      }
      setSelectedIds(new Set());
      load();
    } catch {
      setError(tc("networkError"));
    } finally {
      setActing(false);
    }
  };

  const formatIngestedAt = (raw: string | null) => {
    if (!raw) return "—";
    try {
      return new Date(raw).toLocaleString();
    } catch {
      return raw;
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {confirmDialog}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/admin-panel/laws"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {tc("refresh")}
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ShieldCheck className="h-7 w-7 text-primary" />
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("filters.status")}</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as "pending" | "approved" | "all");
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="pending">{t("filters.pending")}</option>
            <option value="approved">{t("filters.approved")}</option>
            <option value="all">{t("filters.all")}</option>
          </select>
        </div>
        {statusFilter === "pending" && total > 0 && (
          <button
            type="button"
            disabled={acting}
            onClick={() => void setApproval(laws.map((l) => l.id), "approved")}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {t("actions.approvePage", { count: laws.length })}
          </button>
        )}
      </div>

      {warning && (
        <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {warning}
        </p>
      )}
      {error && (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      )}

      {!loading && laws.length > 0 && statusFilter !== "approved" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={selectedCount === 0 || acting}
            onClick={() => void setApproval(Array.from(selectedIds), "approved")}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
          >
            {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {t("actions.approveSelected", { count: selectedCount })}
          </button>
          {statusFilter === "pending" && (
            <p className="text-xs text-muted-foreground">{t("hint")}</p>
          )}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : laws.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{t("empty")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  {statusFilter !== "approved" && (
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
                  )}
                  <th className="text-left p-3 font-medium">{t("table.title")}</th>
                  <th className="text-left p-3 font-medium">{t("table.country")}</th>
                  <th className="text-left p-3 font-medium">{t("table.category")}</th>
                  <th className="text-left p-3 font-medium">{t("table.ingested")}</th>
                  <th className="text-left p-3 font-medium">{t("table.ragStatus")}</th>
                  <th className="text-left p-3 font-medium">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {laws.map((law) => {
                  const isPending = law.rag_approval_status === "pending";
                  return (
                    <tr key={law.id} className="border-b border-border hover:bg-muted/30">
                      {statusFilter !== "approved" && (
                        <td className="p-3 align-top">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(law.id)}
                            onChange={() => toggleRow(law.id)}
                            className="h-4 w-4 rounded border-input"
                            aria-label={`Select ${law.title}`}
                          />
                        </td>
                      )}
                      <td className="p-3">
                        <Link
                          href={`/admin-panel/laws/${law.id}?returnTo=${encodeURIComponent("/admin-panel/laws/rag-approval")}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {law.title}
                        </Link>
                        {law.year != null && (
                          <span className="ml-1 text-xs text-muted-foreground">({law.year})</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{law.countries?.name ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{law.categories?.name ?? "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        <div>{formatIngestedAt(law.ingested_at)}</div>
                        {law.ingested_by && <div className="mt-0.5">{law.ingested_by}</div>}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            isPending
                              ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                              : law.rag_approval_status === "approved"
                                ? "bg-green-500/15 text-green-800 dark:text-green-200"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isPending
                            ? t("status.pending")
                            : law.rag_approval_status === "approved"
                              ? t("status.approved")
                              : t("status.legacy")}
                        </span>
                      </td>
                      <td className="p-3">
                        {isPending ? (
                          <button
                            type="button"
                            disabled={acting}
                            onClick={() => void setApproval([law.id], "approved")}
                            className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                          >
                            {t("actions.approveOne")}
                          </button>
                        ) : law.rag_approval_status === "approved" ? (
                          <button
                            type="button"
                            disabled={acting}
                            onClick={() => void setApproval([law.id], "pending")}
                            className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
                          >
                            {t("actions.revokeOne")}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            {t("pagination", { page, totalPages, total })}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-input p-2 hover:bg-accent disabled:opacity-50"
              aria-label={t("paginationPrev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-input p-2 hover:bg-accent disabled:opacity-50"
              aria-label={t("paginationNext")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
