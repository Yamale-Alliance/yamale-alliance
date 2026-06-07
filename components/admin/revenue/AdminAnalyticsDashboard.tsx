"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
import {
  AdminAnalyticsDetailTables,
  type AnalyticsDetailsPayload,
} from "@/components/admin/revenue/AdminAnalyticsDetailTables";
import { AdminLaunchMetricsResetPanel } from "@/components/admin/AdminLaunchMetricsResetPanel";

const RANGE_OPTIONS: AnalyticsRangePreset[] = ["today", "this_week", "last_week", "last_month", "last_60_days", "last_90_days", "all_time"];

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
  details: AnalyticsDetailsPayload;
  disclaimer: string;
};

export function AdminAnalyticsDashboard() {
  const t = useTranslations("admin.revenue.analyticsDashboard");
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
          setError(typeof j.error === "string" ? j.error : t("errors.failedToLoad"));
          setData(null);
          return;
        }
        setData(j as AnalyticsPayload);
      })
      .catch(() => {
        setError(t("errors.failedToLoad"));
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [range, t]);

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
    () =>
      ({
        all: t("segments.all.label"),
        subscriptions: t("segments.subscriptions.label"),
        lawyer_searches: t("segments.lawyerSearches.label"),
        library_pdf: t("segments.libraryPdf.label"),
        vault: t("segments.vault.label"),
      })[segment],
    [segment, t]
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
                {t("eyebrow")}
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("title")}</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
              {data ? (
                <p className="mt-3 text-xs text-muted-foreground/90 sm:text-sm">{fmtRange(data.from, data.to)}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("dateRange")}</p>
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
                    {t(`ranges.${opt}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/50 p-5 shadow-inner backdrop-blur-sm dark:bg-background/25 sm:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("totalMade")}
                </p>
                <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-foreground sm:text-5xl">
                  {data ? usd(totalCents) : loading ? "—" : "$0.00"}
                </p>
                <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                  {segment === "all" ? (
                    <>{t.rich("segmentDescriptions.all", { strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span> })}</>
                  ) : segment === "subscriptions" ? (
                    <>{t("segmentDescriptions.subscriptions")}</>
                  ) : segment === "lawyer_searches" ? (
                    <>{t("segmentDescriptions.lawyerSearches")}</>
                  ) : segment === "library_pdf" ? (
                    <>{t("segmentDescriptions.libraryPdf")}</>
                  ) : (
                    <>{t("segmentDescriptions.vault")}</>
                  )}
                </p>
                <p className="mt-2 text-xs font-medium text-primary/90">{segmentLabel}</p>
              </div>
              <div className="w-full min-w-0 lg:max-w-md">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("sourceFilter")}</p>
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
                      {t(`segments.${opt.value}.short`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {data && segment === "all" && mixSum > 0 ? (
              <div className="mt-6 border-t border-border/50 pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("mixInWindow")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("mixHint")}
                </p>
                <RevenueMixBar data={data} onPick={(s) => setSegment(s)} className="mt-3" t={t} />
                <MixLegend data={data} mixSum={mixSum} t={t} />
              </div>
            ) : null}
            {data && segment === "all" && mixSum <= 0 ? (
              <p className="mt-6 border-t border-border/50 pt-6 text-xs text-muted-foreground">
                {t("noRevenueInWindow")}
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
              label={t("cards.activePaidSubscribers")}
              value={String(data.subscriptions.activePaidSubscribers)}
              sub={t("cards.estimatedMrr", { amount: usd(data.subscriptions.estimatedMrrUsdCents) })}
              accent="from-violet-500/20 to-fuchsia-500/10"
              dimmed={segment !== "all" && segment !== "subscriptions"}
            />
            <MetricCard
              icon={TrendingUp}
              label={t("cards.newSubscribers")}
              value={String(data.subscriptions.newSubscribersInRange)}
              sub={t("cards.estimatedFirstCycle", {
                amount: usd(data.subscriptions.estimatedNewSubscriberRevenueUsdCents),
              })}
              accent="from-emerald-500/20 to-teal-500/10"
              dimmed={segment !== "all" && segment !== "subscriptions"}
            />
            <MetricCard
              icon={Search}
              label={t("cards.lawyerSearchUnlocks")}
              value={String(data.lawyerSearches.count)}
              sub={usd(data.lawyerSearches.revenueUsdCents)}
              accent="from-sky-500/20 to-blue-500/10"
              dimmed={segment !== "all" && segment !== "lawyer_searches"}
            />
            <MetricCard
              icon={FileDown}
              label={t("cards.libraryPdfUnlocks")}
              value={String(data.documentUnlocks.count)}
              sub={usd(data.documentUnlocks.revenueUsdCents)}
              accent="from-amber-500/20 to-orange-500/10"
              dimmed={segment !== "all" && segment !== "library_pdf"}
            />
            <MetricCard
              icon={Landmark}
              label={t("cards.vault")}
              value={String(data.vaultPurchases.count)}
              sub={usd(data.vaultPurchases.revenueUsdCents)}
              accent="from-primary/25 to-primary/5"
              dimmed={segment !== "all" && segment !== "vault"}
            />
          </div>

          <p className="text-center text-[11px] text-muted-foreground/90">
            {t("scannedUsers", { count: data.totals.clerkUsersScanned })}
          </p>

          <p className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            {data.disclaimer}
          </p>

          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">{t("detailTitle")}</h3>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("detailSubtitle")}</p>
            </div>
            <AdminAnalyticsDetailTables details={data.details} segment={segment} />
          </div>

          <div className="mt-10">
            <AdminLaunchMetricsResetPanel defaultScope="revenue" />
          </div>
        </>
      ) : null}
    </div>
  );
}

function RevenueMixBar({
  data,
  onPick,
  className,
  t,
}: {
  data: AnalyticsPayload;
  onPick: (s: Exclude<AnalyticsSegment, "all">) => void;
  className?: string;
  t: ReturnType<typeof useTranslations>;
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
      aria-label={t("mixAria")}
    >
      {parts.map((p) =>
        p.cents <= 0 ? null : (
          <button
            key={p.seg}
            type="button"
            className={`min-w-[8px] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${p.className}`}
            style={{ flex: p.cents }}
            title={`${t(`segments.${p.seg}.label`)} · ${usd(p.cents)}`}
            onClick={() => onPick(p.seg)}
          />
        )
      )}
    </div>
  );
}

function MixLegend({
  data,
  mixSum,
  t,
}: {
  data: AnalyticsPayload;
  mixSum: number;
  t: ReturnType<typeof useTranslations>;
}) {
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
        const label = t(`segments.${r.seg}.short`);
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
