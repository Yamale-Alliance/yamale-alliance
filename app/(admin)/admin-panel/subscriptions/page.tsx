"use client";

import { useEffect, useState } from "react";
import { Loader2, CreditCard, Clock } from "lucide-react";

type SubscriptionRow = {
  user_id: string;
  email: string | null;
  name: string;
  tier: string;
  status: string;
  cancel_at_period_end: boolean;
  started_at: string;
  current_period_end: string;
};

type ApiResponse = {
  subscriptions: SubscriptionRow[];
  error?: string;
};

export default function AdminSubscriptionsPage() {
  const [data, setData] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${window.location.origin}/api/admin/subscriptions`, { credentials: "include" })
      .then((r) => r.json())
      .then((json: ApiResponse) => {
        if (json.error) {
          setError(json.error);
          setData([]);
        } else {
          setData(Array.isArray(json.subscriptions) ? json.subscriptions : []);
        }
      })
      .catch(() => {
        setError("Failed to load subscriptions");
        setData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <CreditCard className="h-6 w-6" />
          Subscriptions
        </h1>
        <p className="mt-2 text-destructive text-sm">{error}</p>
      </div>
    );
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <CreditCard className="h-6 w-6" />
        AI Subscriptions
      </h1>
      <p className="mt-1 text-sm text-muted-foreground max-w-xl">
        Users who currently have an AI subscription via Stripe. See their plan, when it started, and when their next
        charge or reset to free is scheduled.
      </p>

      <div className="mt-6 rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="p-3 text-left font-medium">User</th>
                <th className="p-3 text-left font-medium">Email</th>
                <th className="p-3 text-left font-medium">Tier</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Started</th>
                <th className="p-3 text-left font-medium">Next payment / Reset</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No active subscriptions found.
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const resetOrNext = row.cancel_at_period_end
                    ? `Resets to free on ${formatDateTime(row.current_period_end)}`
                    : `Next payment on ${formatDateTime(row.current_period_end)}`;

                  return (
                    <tr key={`${row.user_id}-${row.started_at}`} className="border-b border-border hover:bg-muted/40">
                      <td className="p-3">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-[11px] text-muted-foreground/80">User ID: {row.user_id}</div>
                      </td>
                      <td className="p-3 text-muted-foreground">{row.email ?? "—"}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                          {row.tier}
                        </span>
                      </td>
                      <td className="p-3 capitalize">{row.status.replace(/_/g, " ")}</td>
                      <td className="p-3">{formatDateTime(row.started_at)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{resetOrNext}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

