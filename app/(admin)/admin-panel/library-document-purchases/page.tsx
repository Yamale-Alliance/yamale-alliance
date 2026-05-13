"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FileDown, Loader2, RefreshCw } from "lucide-react";

type PurchaseRow = {
  id: string;
  user_id: string;
  buyer_name: string;
  law_id: string | null;
  law_title: string | null;
  stripe_session_id: string | null;
  created_at: string;
};

export default function AdminLibraryDocumentPurchasesPage() {
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
            (status === 401 ? "Sign in required" : status === 403 ? "Admin access required" : "Failed to load");
          setError(data?.details ? `${msg}: ${data.details}` : msg);
          setPurchases([]);
          return;
        }
        setPurchases(Array.isArray(data?.purchases) ? data.purchases : []);
      })
      .catch(() => {
        setError("Failed to load purchases");
        setPurchases([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const formatDate = (dateString: string | null | undefined) => {
    if (dateString == null || dateString === "") return "—";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return "—";
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-8 md:px-8 md:py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <FileDown className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Library law PDF purchases</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Pay-as-you-go unlocks for exporting a single law as PDF (PawaPay or Lomi). Each row is stored in
                Supabase as <code className="rounded bg-muted px-1 py-0.5 text-xs">pay_as_you_go_purchases</code> with{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">item_type = document</code>. The same table
                powers <Link className="font-medium text-primary hover:underline" href="/library/purchased">Purchased laws</Link>{" "}
                for signed-in users.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchPurchases()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-8 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Buyer</th>
                <th className="p-3 font-medium">Law</th>
                <th className="p-3 font-medium">Payment ref</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin opacity-50" />
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-muted-foreground">
                    No library PDF purchases yet. They appear after a successful PawaPay or Lomi payment and webhook or
                    client confirmation.
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p.id} className="border-b border-border/80 last:border-0">
                    <td className="whitespace-nowrap p-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{p.buyer_name}</div>
                      <div className="mt-0.5 font-mono text-xs text-muted-foreground">{p.user_id}</div>
                    </td>
                    <td className="p-3">
                      {p.law_id ? (
                        <>
                          <Link
                            href={`/admin-panel/laws/${p.law_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {p.law_title ?? p.law_id}
                          </Link>
                          <div className="mt-0.5 font-mono text-xs text-muted-foreground">{p.law_id}</div>
                        </>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">Law not linked yet</span>
                      )}
                    </td>
                    <td className="max-w-[220px] truncate p-3 font-mono text-xs text-muted-foreground" title={p.stripe_session_id ?? ""}>
                      {p.stripe_session_id ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
