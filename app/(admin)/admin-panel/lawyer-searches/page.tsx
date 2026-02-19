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
  daysLeft: number;
  stripeSessionId: string | null;
};

export default function AdminLawyerSearchesPage() {
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/lawyer-searches")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setSearches(data);
        }
      })
      .catch((err) => {
        console.error("Error fetching searches:", err);
        setError("Failed to load searches");
      })
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
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
          View all active lawyer searches purchased by users. Each search grants access to matching lawyers for 30 days.
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
                <th className="text-left p-3 font-medium">Days Left</th>
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
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        search.daysLeft <= 7
                          ? "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400"
                          : search.daysLeft <= 14
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400"
                          : "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400"
                      }`}
                    >
                      {search.daysLeft} {search.daysLeft === 1 ? "day" : "days"}
                    </span>
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
