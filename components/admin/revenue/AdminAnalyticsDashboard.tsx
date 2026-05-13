"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AnalyticsRangePreset } from "@/lib/admin-analytics-ranges";
import {
  ANALYTICS_SEGMENT_OPTIONS,
  getSegmentRevenueUsdCents,
  parseAnalyticsSegment,
  type AnalyticsSegment,
} from "@/lib/admin-analytics-segment";
import {
  CreditCard,
  FileDown,
  Landmark,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const RANGE_OPTIONS: { value: AnalyticsRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "last_month", label: "Last month" },
  { value: "last_60_days", label: "Last 60 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "all_time", label: "All time" },
];

function usd(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

type AnalyticsPayload = {
  preset: AnalyticsRangePreset;
  from: string;
  to: string;
  subscriptions: {
    activePaidSubscribers: number;
    estimatedMrrUsdCents: number;
    newSubscribersInRange: number;
    estimatedNewSubscriberRevenueUsdCents: number;
  };
  lawyerSearches: { count: number; revenueUsdCents: number };
  documentUnlocks: { count: number; revenueUsdCents: number; units: number };
  vaultPurchases: { count: number; revenueUsdCents: number };
  totals: {
    transactionRevenueUsdCents: number;
    combinedPeriodRevenueUsdCents: number;
    clerkUsersScanned: number;
  };
  disclaimer: string;
};

export function AdminAnalyticsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const segment = parseAnalyticsSegment(searchParams.get("segment"));

  const setSegment = useCallback(
    (next: AnalyticsSegment) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "analytics");
      if (next === "all") {
        params.delete("segment");
      } else {
        params.set("segment", next);
      }
      router.replace(`/admin-panel/revenue?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const [range, setRange] = useState<AnalyticsRangePreset>("last_90_days");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics?range=${encodeURIComponent(range)}`, { credentials: "include" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok || j.error) {
          setError(typeof j.error === "string" ? j.error : "Failed to load analytics");
          setData(null);
          return;
        }
        setData(j as AnalyticsPayload);
      })
      .catch(() => {
        setError("Failed to load analytics");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmtRange = (from: string, to: string) => {
    const a = new Date(from);
    const b = new Date(to);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
    return `${a.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} — ${b.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  };

  const segmentLabel = useMemo(
    () => ANALYTICS_SEGMENT_OPTIONS.find((o) => o.value === segment)?.label ?? "All sources",
    [segment]
  );

  const totalCents = data ? getSegmentRevenueUsdCents(segment, data) : 0;

  const mixSum =
    data === null
      ? 0
      : data.subscriptions.estimatedNewSubscriberRevenueUsdCents +
        data.lawyerSearches.revenueUsdCents +
        data.documentUnlocks.revenueUsdCents +
        data.vaultPurchases.revenueUsdCents;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.12] via-card to-card p-6 shadow-lg shadow-primary/5 sm:p-8 md:p-10 dark:from-primary/10 dark:via-card dark:to-background">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl dark:bg-primary/15"
          aria-hidden
        />
        <div className="relative space-y-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Revenue intelligence
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Analytics</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                Paid AI plans (period + run-rate), one-time unlocks, and Vault sales. Pick a date window and a source
                to see totals for that slice.
              </p>
              {data ? (
                <p className="mt-3 text-xs text-muted-foreground/90 sm:text-sm">{fmtRange(data.from, data.to)}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date range</p>
              <div className="flex flex-wrap gap-2">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRange(opt.value)}
                    className={`rounded-full px-3.5 py-2 text-xs font-medium transition-all sm:px-4 sm:text-sm ${
                      range === opt.value
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : "border border-border/80 bg-background/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/50 p-5 shadow-inner backdrop-blur-sm dark:bg-background/25 sm:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total made (this window)
                </p>
                <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-foreground sm:text-5xl">
                  {data ? usd(totalCents) : loading ? "—" : "$0.00"}
                </p>
                <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                  {segment === "all" ? (
                    <>
                      Sum of <span className="font-medium text-foreground">estimated first payments</span> for new paid
                      subscribers in range, plus document unlocks, lawyer search unlocks, and Vault purchases (list /
                      item prices).
                    </>
                  ) : segment === "subscriptions" ? (
                    <>
                      Estimated revenue from users who became paid subscribers in this window (first cycle from Admin
                      pricing; not MRR).
                    </>
                  ) : segment === "lawyer_searches" ? (
                    <>Lawyer search unlock rows in range at the configured list price.</>
                  ) : segment === "library_pdf" ? (
                    <>Library PDF unlock rows in range at the configured list price.</>
                  ) : (
                    <>Marketplace purchase rows in range, priced from each Vault item.</>
                  )}
                </p>
                <p className="mt-2 text-xs font-medium text-primary/90">{segmentLabel}</p>
              </div>
              <div className="w-full min-w-0 lg:max-w-md">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Source filter</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ANALYTICS_SEGMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSegment(opt.value)}
                      className={`rounded-full px-3 py-2 text-xs font-medium transition-all sm:text-sm ${
                        segment === opt.value
                          ? "bg-foreground text-background shadow-md"
                          : "border border-border/80 bg-card/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {opt.short}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {data && segment === "all" && mixSum > 0 ? (
              <div className="mt-6 border-t border-border/50 pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Mix in this window
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tap a band to filter the total above to that source.
                </p>
                <RevenueMixBar data={data} onPick={(s) => setSegment(s)} className="mt-3" />
                <MixLegend data={data} mixSum={mixSum} />
              </div>
            ) : null}
            {data && segment === "all" && mixSum <= 0 ? (
              <p className="mt-6 border-t border-border/50 pt-6 text-xs text-muted-foreground">
                No period revenue in this window yet. Try a longer range or another day.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          {error}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              icon={CreditCard}
              label="Active paid subscribers"
              value={String(data.subscriptions.activePaidSubscribers)}
              sub={`Est. MRR ${usd(data.subscriptions.estimatedMrrUsdCents)}`}
              accent="from-violet-500/20 to-fuchsia-500/10"
              dimmed={segment !== "all" && segment !== "subscriptions"}
            />
            <MetricCard
              icon={TrendingUp}
              label="New subscribers (period)"
              value={String(data.subscriptions.newSubscribersInRange)}
              sub={`Est. first-cycle ${usd(data.subscriptions.estimatedNewSubscriberRevenueUsdCents)}`}
              accent="from-emerald-500/20 to-teal-500/10"
              dimmed={segment !== "all" && segment !== "subscriptions"}
            />
            <MetricCard
              icon={Search}
              label="Lawyer search unlocks"
              value={String(data.lawyerSearches.count)}
              sub={usd(data.lawyerSearches.revenueUsdCents)}
              accent="from-sky-500/20 to-blue-500/10"
              dimmed={segment !== "all" && segment !== "lawyer_searches"}
            />
            <MetricCard
              icon={FileDown}
              label="Library PDF unlocks"
              value={String(data.documentUnlocks.count)}
              sub={usd(data.documentUnlocks.revenueUsdCents)}
              accent="from-amber-500/20 to-orange-500/10"
              dimmed={segment !== "all" && segment !== "library_pdf"}
            />
            <MetricCard
              icon={Landmark}
              label="Yamalé Vault"
              value={String(data.vaultPurchases.count)}
              sub={usd(data.vaultPurchases.revenueUsdCents)}
              accent="from-primary/25 to-primary/5"
              dimmed={segment !== "all" && segment !== "vault"}
            />
          </div>

          <p className="text-center text-[11px] text-muted-foreground/90">
            Scanned {data.totals.clerkUsersScanned} Clerk users for subscription metrics.
          </p>

          <p className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            {data.disclaimer}
          </p>
        </>
      ) : null}
    </div>
  );
}

function RevenueMixBar({
  data,
  onPick,
  className,
}: {
  data: AnalyticsPayload;
  onPick: (s: Exclude<AnalyticsSegment, "all">) => void;
  className?: string;
}) {
  const parts: { seg: Exclude<AnalyticsSegment, "all">; cents: number; className: string }[] = [
    { seg: "subscriptions", cents: data.subscriptions.estimatedNewSubscriberRevenueUsdCents, className: "bg-violet-500" },
    { seg: "lawyer_searches", cents: data.lawyerSearches.revenueUsdCents, className: "bg-sky-500" },
    { seg: "library_pdf", cents: data.documentUnlocks.revenueUsdCents, className: "bg-amber-500" },
    { seg: "vault", cents: data.vaultPurchases.revenueUsdCents, className: "bg-primary" },
  ];
  const sum = parts.reduce((a, p) => a + p.cents, 0);
  if (sum <= 0) return null;

  return (
    <div
      className={`flex h-4 w-full overflow-hidden rounded-full bg-muted/50 ring-1 ring-border/40 ${className ?? ""}`}
      role="group"
      aria-label="Revenue mix by source"
    >
      {parts.map((p) =>
        p.cents <= 0 ? null : (
          <button
            key={p.seg}
            type="button"
            className={`min-w-[8px] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${p.className}`}
            style={{ flex: p.cents }}
            title={`${ANALYTICS_SEGMENT_OPTIONS.find((o) => o.value === p.seg)?.label ?? p.seg} · ${usd(p.cents)}`}
            onClick={() => onPick(p.seg)}
          />
        )
      )}
    </div>
  );
}

function MixLegend({ data, mixSum }: { data: AnalyticsPayload; mixSum: number }) {
  if (mixSum <= 0) return null;
  const rows: { seg: Exclude<AnalyticsSegment, "all">; cents: number; dot: string }[] = [
    { seg: "subscriptions", cents: data.subscriptions.estimatedNewSubscriberRevenueUsdCents, dot: "bg-violet-500" },
    { seg: "lawyer_searches", cents: data.lawyerSearches.revenueUsdCents, dot: "bg-sky-500" },
    { seg: "library_pdf", cents: data.documentUnlocks.revenueUsdCents, dot: "bg-amber-500" },
    { seg: "vault", cents: data.vaultPurchases.revenueUsdCents, dot: "bg-primary" },
  ];
  return (
    <ul className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
      {rows.map((r) => {
        const pct = mixSum > 0 ? Math.round((r.cents / mixSum) * 100) : 0;
        const label = ANALYTICS_SEGMENT_OPTIONS.find((o) => o.value === r.seg)?.short ?? r.seg;
        return (
          <li key={r.seg} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className={`h-2 w-2 shrink-0 rounded-full ${r.dot}`} aria-hidden />
              {label}
            </span>
            <span className="tabular-nums font-medium text-foreground">
              {usd(r.cents)}
              <span className="ml-1.5 font-normal text-muted-foreground">({pct}%)</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function MetricCard(props: {
  icon: typeof CreditCard;
  label: string;
  value: string;
  sub: string;
  accent: string;
  dimmed?: boolean;
}) {
  const Icon = props.icon;
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br ${props.accent} p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        props.dimmed ? "opacity-45 saturate-50" : "opacity-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-xl bg-background/70 p-2 shadow-sm dark:bg-background/40">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-foreground">{props.value}</p>
      <p className="mt-2 text-sm font-medium text-primary/90">{props.sub}</p>
    </div>
  );
}
