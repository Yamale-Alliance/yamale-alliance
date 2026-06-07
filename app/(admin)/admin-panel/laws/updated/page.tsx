"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";

type UpdatedLawEntry = {
  id: string;
  law_id: string | null;
  law_title: string;
  changed_fields: string[];
  restored: boolean;
  admin_email: string | null;
  created_at: string;
};

const FIELD_KEYS = [
  "title",
  "category_id",
  "country_id",
  "applies_to_all_countries",
  "status",
  "year",
  "content",
] as const;

const PAGE_SIZE = 25;

export default function AdminRecentlyUpdatedLawsPage() {
  const t = useTranslations("admin.laws.updated");
  const tc = useTranslations("admin.common");
  const [rows, setRows] = useState<UpdatedLawEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = () => {
    setLoading(true);
    setError(null);
    const offset = (page - 1) * PAGE_SIZE;
    fetch(`/api/admin/laws/recent-updates?limit=${PAGE_SIZE}&offset=${offset}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setRows(Array.isArray(data?.entries) ? data.entries : []);
        setTotal(typeof data?.total === "number" ? data.total : 0);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
        setError(t("errors.loadFailed"));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
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

      <div className="mb-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="p-2 text-left font-medium">{tc("when")}</th>
                  <th className="p-2 text-left font-medium">{t("table.law")}</th>
                  <th className="p-2 text-left font-medium">{t("table.changed")}</th>
                  <th className="p-2 text-left font-medium">{t("table.updatedBy")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="p-2 align-top text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="p-2 align-top">
                      <div className="font-medium">{row.law_title}</div>
                      {row.restored && (
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          {t("restored")}
                        </div>
                      )}
                    </td>
                    <td className="p-2 align-top">
                      {row.changed_fields.length === 0 ? (
                        <span className="text-xs text-muted-foreground">{t("noFieldMetadata")}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.changed_fields.map((field) => (
                            <span
                              key={`${row.id}-${field}`}
                              className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium"
                            >
                              {FIELD_KEYS.includes(field as (typeof FIELD_KEYS)[number])
                                ? t(`fieldLabels.${field as (typeof FIELD_KEYS)[number]}`)
                                : field}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-2 align-top text-muted-foreground">
                      {row.admin_email ?? t("unknownAdmin")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {tc("previous")}
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                {tc("next")}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

