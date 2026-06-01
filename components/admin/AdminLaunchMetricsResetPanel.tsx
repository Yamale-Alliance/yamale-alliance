"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { LAUNCH_METRICS_RESET_CONFIRM_PHRASE, LAUNCH_METRICS_RESET_TABLE_LABELS } from "@/lib/admin-reset-launch-metrics";

type Scope = "all" | "revenue" | "ai";

type TableResult = {
  table: string;
  deleted: number | null;
  error: string | null;
};

export function AdminLaunchMetricsResetPanel({ defaultScope = "all" }: { defaultScope?: Scope }) {
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ message?: string; tables?: TableResult[] } | null>(null);

  const canSubmit = confirmText === LAUNCH_METRICS_RESET_CONFIRM_PHRASE && !loading;

  const runReset = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reset-launch-metrics", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText, scope }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reset failed");
        if (data.tables) setResult({ tables: data.tables });
        return;
      }
      setResult({ message: data.message, tables: data.tables });
      setConfirmText("");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground">Reset launch metrics</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Clears Supabase purchase and usage rows so <strong className="font-medium text-foreground">Revenue &amp; analytics</strong> and{" "}
            <strong className="font-medium text-foreground">AI usage</strong> start fresh after go-live. This does{" "}
            <strong className="font-medium text-foreground">not</strong> change Clerk subscription metadata — paid tiers in
            Clerk may still show in subscription estimates until you adjust users manually.
          </p>
          <p className="mt-2 text-sm text-destructive/90">
            Clearing revenue data removes vault purchases, library PDF unlocks, lawyer unlocks, and related PAYG rows. Customers
            will lose access tied only to those purchase records.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                { value: "all" as const, label: "Everything" },
                { value: "revenue" as const, label: "Revenue & purchases only" },
                { value: "ai" as const, label: "AI usage only" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setScope(opt.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  scope === opt.value
                    ? "border-destructive bg-destructive/15 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-destructive/40"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-sm font-medium text-foreground">
            Type <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{LAUNCH_METRICS_RESET_CONFIRM_PHRASE}</code> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-1 w-full max-w-md rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder={LAUNCH_METRICS_RESET_CONFIRM_PHRASE}
            autoComplete="off"
          />

          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void runReset()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Reset {scope === "all" ? "all launch metrics" : scope === "revenue" ? "revenue data" : "AI usage"}
          </button>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          {result?.message ? (
            <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{result.message}</p>
          ) : null}
          {result?.tables?.length ? (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-background/80 p-3 text-xs">
              {result.tables.map((row) => (
                <li key={row.table} className="flex justify-between gap-2">
                  <span>{LAUNCH_METRICS_RESET_TABLE_LABELS[row.table] ?? row.table}</span>
                  <span className={row.error ? "text-destructive" : "text-muted-foreground"}>
                    {row.error ? row.error : `${row.deleted ?? 0} deleted`}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
