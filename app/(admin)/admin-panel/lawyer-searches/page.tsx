"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

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
};

export default function AdminLawyerSearchesPage() {
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/lawyer-searches", { credentials: "include" })
      .then((res) => {
        return res.json().then((data) => ({ ok: res.ok, status: res.status, data }));
      })
      .then(({ ok, status, data }) => {
        if (!ok) {
          const msg = data?.error ?? (status === 401 ? "Sign in required" : status === 403 ? "Admin access required" : "Failed to load searches");
          setError(data?.details ? `${msg}: ${data.details}` : msg);
        } else if (data?.error) {
          setError(data.error);
        } else {
          setSearches(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        console.error("Error fetching searches:", err);
        setError("Failed to load searches");
      })
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-8 md:px-8 md:py-10">
        <h1 className="heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Lawyer Searches
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          View lawyer searches purchased by users. Each search grants access for 30 days from the date of purchase.
        </p>
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="mt-8 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      ) : searches.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No active searches found.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">User</th>
                <th className="text-left p-3 font-medium">Search</th>
                <th className="text-left p-3 font-medium">Date Purchased</th>
                <th className="text-left p-3 font-medium">Date of Expiry</th>
              </tr>
            </thead>
            <tbody>
              {searches.map((search, idx) => (
                <tr
                  key={`${search.userId}-${search.country}-${search.expertise}-${idx}`}
                  className="border-b border-border last:border-0"
                >
                  <td className="p-3">
                    <div className="font-medium text-foreground">{search.userName}</div>
                    {search.userEmail && (
                      <div className="text-xs text-muted-foreground">{search.userEmail}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="font-medium text-foreground">{search.search}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {formatDate(search.datePurchased)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {formatDate(search.expiresAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
