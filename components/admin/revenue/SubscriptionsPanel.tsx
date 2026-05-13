"use client";

import { useEffect, useState } from "react";
import { Clock, CreditCard, Loader2 } from "lucide-react";

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

export function SubscriptionsPanel() {
  const [data, setData] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/admin/subscriptions`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((json: { subscriptions?: SubscriptionRow[]; error?: string }) => {
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

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-2 text-foreground">
        <CreditCard className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">AI subscriptions</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Paid AI plans (Basic / Pro / Team). Renewal dates come from Clerk metadata.
      </p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
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
                  <tr key={`${row.user_id}-${row.started_at}`} className="border-b border-border/80 last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-[11px] text-muted-foreground">User ID: {row.user_id}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{row.email ?? "—"}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium capitalize text-primary">
                        {row.tier}
                      </span>
                    </td>
                    <td className="p-3 capitalize">{row.status.replace(/_/g, " ")}</td>
                    <td className="p-3">{formatDateTime(row.started_at)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" />
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
  );
}
