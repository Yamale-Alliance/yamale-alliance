"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Cpu } from "lucide-react";
import { AdminLaunchMetricsResetPanel } from "@/components/admin/AdminLaunchMetricsResetPanel";

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
  const t = useTranslations("admin.aiUsage");
  const tc = useTranslations("admin.common");
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
        setError(err?.error ?? t("failedToLoad"));
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
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-destructive">{error ?? t("failedToLoad")}</p>
      </div>
    );
  }

  const totalEstUsd = (data.total_estimated_usage_usd_cents ?? 0) / 100;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Cpu className="h-6 w-6" />
        {t("title")}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {t("subtitle")}{" "}
        <span className="text-foreground/80">{t("disclaimer")}</span>
      </p>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("queriesThisMonth")}</p>
          <p className="mt-1 text-2xl font-semibold">{data.total_queries}</p>
          <p className="text-xs text-muted-foreground">{t("monthLabel", { month: data.month })}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{tc("inputTokens")}</p>
          <p className="mt-1 text-2xl font-semibold">{data.total_input_tokens.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{tc("outputTokens")}</p>
          <p className="mt-1 text-2xl font-semibold">{data.total_output_tokens.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("estApiCostMonth")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {totalEstUsd.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t("sumPerUserEstimates")}</p>
        </div>
      </div>

      {/* Per-user table */}
      <div className="mt-6 rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">{tc("user")}</th>
                <th className="text-left p-3 font-medium">{tc("email")}</th>
                <th className="text-right p-3 font-medium">{tc("queries")}</th>
                <th className="text-right p-3 font-medium">{tc("inputTokens")}</th>
                <th className="text-right p-3 font-medium">{tc("outputTokens")}</th>
                <th className="text-right p-3 font-medium">{tc("totalTokens")}</th>
                <th className="text-right p-3 font-medium">{tc("estCost")}</th>
              </tr>
            </thead>
            <tbody>
              {data.usage.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {t("noUsageForMonth", { month: data.month })}
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

      <div className="mt-10">
        <AdminLaunchMetricsResetPanel defaultScope="ai" />
      </div>
    </div>
  );
}
