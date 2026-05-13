"use client";

import { useState, useEffect } from "react";
import { Loader2, Cpu } from "lucide-react";
import { AI_TOKEN_COST_ESTIMATE_DISCLAIMER } from "@/lib/ai-token-cost-estimate";

type UsageRow = {
  user_id: string;
  current_month: string;
  query_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  previous_month_query_count: number;
  estimated_usage_usd_cents: number;
};

type AiUsageResponse = {
  month: string;
  prev_month: string;
  usage: UsageRow[];
  total_queries: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_estimated_usage_usd_cents: number;
};

type UserRow = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  tier: string;
};

export default function AdminAiUsagePage() {
  const [data, setData] = useState<AiUsageResponse | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${window.location.origin}/api/admin/ai-usage`, { credentials: "include" }).then((r) =>
        r.json().then((d) => (r.ok ? d : Promise.reject(d)))
      ),
      fetch(`${window.location.origin}/api/admin/users`, { credentials: "include" }).then((r) =>
        r.json().then((d) => (Array.isArray(d) ? d : []))
      ),
    ])
      .then(([usageRes, usersList]) => {
        setData(usageRes as AiUsageResponse);
        setUsers(usersList as UserRow[]);
      })
      .catch((err) => {
        setError(err?.error ?? "Failed to load AI usage");
      })
      .finally(() => setLoading(false));
  }, []);

  const userMap = new Map(users.map((u) => [u.id, u]));

  if (loading) {
    return (
      <div className="p-4 sm:p-6 flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">AI Usage</h1>
        <p className="mt-2 text-destructive">{error ?? "Failed to load"}</p>
      </div>
    );
  }

  const totalEstUsd = (data.total_estimated_usage_usd_cents ?? 0) / 100;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Cpu className="h-6 w-6" />
        AI Usage
      </h1>
      <p className="mt-1 text-muted-foreground">
        Credits (queries) and token usage for the current month. Limits: Basic 10/mo, Pro 50/mo, Team unlimited.{" "}
        <span className="text-foreground/80">{AI_TOKEN_COST_ESTIMATE_DISCLAIMER}</span>
      </p>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Queries this month</p>
          <p className="mt-1 text-2xl font-semibold">{data.total_queries}</p>
          <p className="text-xs text-muted-foreground">Month: {data.month}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Input tokens</p>
          <p className="mt-1 text-2xl font-semibold">{data.total_input_tokens.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Output tokens</p>
          <p className="mt-1 text-2xl font-semibold">{data.total_output_tokens.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Est. API cost (month)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {totalEstUsd.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">Sum of per-user token estimates.</p>
        </div>
      </div>

      {/* Per-user table */}
      <div className="mt-6 rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">User</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-right p-3 font-medium">Queries</th>
                <th className="text-right p-3 font-medium">Input tokens</th>
                <th className="text-right p-3 font-medium">Output tokens</th>
                <th className="text-right p-3 font-medium">Total tokens</th>
                <th className="text-right p-3 font-medium">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {data.usage.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No AI usage recorded for {data.month} yet.
                  </td>
                </tr>
              ) : (
                data.usage.map((row) => {
                  const u = userMap.get(row.user_id);
                  return (
                    <tr key={row.user_id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3">
                        {u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || "—" : row.user_id.slice(0, 8) + "…"}
                      </td>
                      <td className="p-3 text-muted-foreground">{u?.email ?? "—"}</td>
                      <td className="p-3 text-right font-medium">{row.query_count}</td>
                      <td className="p-3 text-right text-muted-foreground">{row.input_tokens.toLocaleString()}</td>
                      <td className="p-3 text-right text-muted-foreground">{row.output_tokens.toLocaleString()}</td>
                      <td className="p-3 text-right">{row.total_tokens.toLocaleString()}</td>
                      <td className="p-3 text-right font-medium tabular-nums text-muted-foreground">
                        {((row.estimated_usage_usd_cents ?? 0) / 100).toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 2,
                        })}
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
