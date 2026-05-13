"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Undo2 } from "lucide-react";

type SearchRow = {
  userId: string;
  userName: string;
  userEmail: string | null;
  search: string;
  country: string;
  expertise: string;
  datePurchased: string;
  expiresAt: string;
  stripeSessionId: string | null;
  source: "grant" | "unlock";
  grantId?: string;
};

export function LawyerSearchesPanel() {
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const fetchSearches = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/lawyer-searches", { credentials: "include" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, status: res.status, data })))
      .then(({ ok, status, data }) => {
        if (!ok) {
          const msg =
            data?.error ?? (status === 401 ? "Sign in required" : status === 403 ? "Admin access required" : "Failed to load");
          setError(data?.details ? `${msg}: ${data.details}` : msg);
          setSearches([]);
        } else if (data?.error) {
          setError(data.error);
        } else {
          setSearches(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        setError("Failed to load searches");
        setSearches([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  const revertKey = (row: SearchRow) =>
    row.source === "grant" && row.grantId ? row.grantId : `unlock-${row.userId}-${row.country}-${row.expertise}`;

  async function handleRevert(row: SearchRow) {
    const id = revertKey(row);
    setRevertingId(id);
    setError(null);
    try {
      const body =
        row.source === "grant" && row.grantId
          ? { grantId: row.grantId }
          : { source: "unlock" as const, userId: row.userId, country: row.country, expertise: row.expertise };
      const res = await fetch("/api/admin/lawyer-searches/revert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? data?.details ?? "Failed to revert");
        return;
      }
      setSearches((prev) => prev.filter((s) => revertKey(s) !== id));
    } catch {
      setError("Failed to revert search");
    } finally {
      setRevertingId(null);
    }
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (dateString == null || dateString === "") return "—";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return "—";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Lawyer search purchases</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Paid searches (30-day access). You can revert a row to revoke access.
      </p>
      {error ? (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      ) : null}
      {searches.length === 0 && !error ? (
        <p className="mt-6 text-center text-muted-foreground">No active searches found.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="p-3 text-left font-medium">User</th>
                <th className="p-3 text-left font-medium">Search</th>
                <th className="p-3 text-left font-medium">Purchased</th>
                <th className="p-3 text-left font-medium">Expires</th>
                <th className="p-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {searches.map((search, idx) => {
                const key = revertKey(search);
                const isReverting = revertingId === key;
                return (
                  <tr key={`${search.userId}-${search.country}-${search.expertise}-${idx}`} className="border-b border-border/80 last:border-0">
                    <td className="p-3">
                      <div className="font-medium">{search.userName}</div>
                      {search.userEmail ? <div className="text-xs text-muted-foreground">{search.userEmail}</div> : null}
                    </td>
                    <td className="p-3 font-medium">{search.search}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(search.datePurchased)}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(search.expiresAt)}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleRevert(search)}
                        disabled={isReverting}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                      >
                        {isReverting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                        Revert
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
