"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileDown, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

type PurchaseRow = {
  id: string;
  user_id: string;
  buyer_name: string;
  law_id: string | null;
  law_title: string | null;
  stripe_session_id: string | null;
  created_at: string;
};

export function LibraryPdfPanel() {
  const t = useTranslations("admin.revenue.libraryPdfPanel");
  const tc = useTranslations("admin.common");
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPurchases = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/library-document-purchases", { credentials: "include" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, status: res.status, data })))
      .then(({ ok, status, data }) => {
        if (!ok) {
          const msg =
            data?.error ??
            (status === 401 ? t("errors.signInRequired") : status === 403 ? t("errors.adminAccessRequired") : t("errors.failedToLoad"));
          setError(data?.details ? `${msg}: ${data.details}` : msg);
          setPurchases([]);
          return;
        }
        setPurchases(Array.isArray(data?.purchases) ? data.purchases : []);
      })
      .catch(() => {
        setError(t("errors.failedToLoadPurchases"));
        setPurchases([]);
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const formatDate = (dateString: string | null | undefined) => {
    if (dateString == null || dateString === "") return "—";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return "—";
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileDown className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{t("title")}</h3>
        </div>
        <button
          type="button"
          onClick={() => fetchPurchases()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {tc("refresh")}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {t.rich("subtitle", {
          code: (chunks) => <code className="rounded bg-muted px-1 text-xs">{chunks}</code>,
          strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
        })}
      </p>
      {error ? (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="p-3 font-medium">{t("table.date")}</th>
              <th className="p-3 font-medium">{t("table.buyer")}</th>
              <th className="p-3 font-medium">{t("table.law")}</th>
              <th className="p-3 font-medium">{t("table.paymentRef")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin opacity-50" />
                </td>
              </tr>
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-muted-foreground">
                  {t("table.noPurchases")}
                </td>
              </tr>
            ) : (
              purchases.map((p) => (
                <tr key={p.id} className="border-b border-border/80 last:border-0">
                  <td className="whitespace-nowrap p-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                  <td className="p-3">
                    <div className="font-medium">{p.buyer_name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{p.user_id}</div>
                  </td>
                  <td className="p-3">
                    {p.law_id ? (
                      <>
                        <Link href={`/admin-panel/laws/${p.law_id}`} className="font-medium text-primary hover:underline">
                          {p.law_title ?? p.law_id}
                        </Link>
                        <div className="font-mono text-[11px] text-muted-foreground">{p.law_id}</div>
                      </>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">{t("table.lawNotLinked")}</span>
                    )}
                  </td>
                  <td className="max-w-[200px] truncate p-3 font-mono text-xs text-muted-foreground" title={p.stripe_session_id ?? ""}>
                    {p.stripe_session_id ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
