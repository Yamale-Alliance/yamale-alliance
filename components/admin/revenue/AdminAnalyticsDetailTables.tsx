"use client";

import type { AnalyticsSegment } from "@/lib/admin-analytics-segment";
import { useTranslations } from "next-intl";

export type AnalyticsDetailVaultRow = {
  id: string;
  userId: string;
  buyerLabel: string;
  buyerEmail: string | null;
  itemId: string;
  itemTitle: string;
  priceUsdCents: number;
  paymentRef: string | null;
  createdAt: string;
};

export type AnalyticsDetailPaygRow = {
  id: string;
  userId: string;
  buyerLabel: string;
  buyerEmail: string | null;
  itemType: string;
  productLabel: string;
  quantity: number;
  lawId: string | null;
  lineUsdCents: number;
  paymentRef: string | null;
  createdAt: string;
};

export type AnalyticsDetailNewSubRow = {
  userId: string;
  buyerLabel: string;
  buyerEmail: string | null;
  tier: string;
  billing: string;
  subscriberSince: string;
  estimatedFirstPaymentUsdCents: number;
  isComplimentaryGrant: boolean;
};

export type AnalyticsDetailsPayload = {
  vaultPurchases: AnalyticsDetailVaultRow[];
  payAsYouGo: AnalyticsDetailPaygRow[];
  newSubscribers: AnalyticsDetailNewSubRow[];
  limits: { vaultPurchases: number; payAsYouGo: number; newSubscribers: number };
  truncated: { vaultPurchases: boolean; payAsYouGo: boolean; newSubscribers: boolean };
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const th =
  "border-b border-border bg-muted/50 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const td = "border-b border-border/70 px-3 py-2.5 align-top text-foreground";

export function AdminAnalyticsDetailTables(props: {
  details: AnalyticsDetailsPayload;
  segment: AnalyticsSegment;
}) {
  const t = useTranslations("admin.revenue.analyticsDetailTables");
  const tc = useTranslations("admin.common");
  const { details, segment } = props;
  const showVault = segment === "all" || segment === "vault";
  const showPayg = segment === "all" || segment === "lawyer_searches" || segment === "library_pdf";
  const showSubs = segment === "all" || segment === "subscriptions";

  const paygFiltered =
    segment === "lawyer_searches"
      ? details.payAsYouGo.filter((r) => r.itemType === "lawyer_search")
      : segment === "library_pdf"
        ? details.payAsYouGo.filter((r) => r.itemType === "document")
        : details.payAsYouGo;

  const truncNote = (label: string, hit: boolean) =>
    hit ? (
      <p className="mt-2 text-xs text-amber-800/90 dark:text-amber-200/90">
        {t("truncation", { label })}
      </p>
    ) : null;

  return (
    <div className="space-y-10">
      {showSubs && details.newSubscribers.length > 0 ? (
        <section className={segment === "subscriptions" ? "" : "opacity-95"}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{t("newSubscribers.title")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("newSubscribers.subtitle")}
            </p>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border/80 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={th}>{t("newSubscribers.columns.who")}</th>
                    <th className={th}>{tc("email")}</th>
                    <th className={th}>{t("newSubscribers.columns.plan")}</th>
                    <th className={th}>{t("newSubscribers.columns.billing")}</th>
                    <th className={th}>{t("newSubscribers.columns.subscriberSince")}</th>
                    <th className={`${th} text-right`}>{t("newSubscribers.columns.estimatedFirstPayment")}</th>
                    <th className={th}>{t("newSubscribers.columns.note")}</th>
                  </tr>
                </thead>
                <tbody>
                  {details.newSubscribers.map((r) => (
                    <tr key={r.userId} className="bg-card/40 hover:bg-muted/30">
                      <td className={td}>
                        <span className="font-medium">{r.buyerLabel}</span>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{r.userId}</p>
                      </td>
                      <td className={`${td} max-w-[200px] truncate`} title={r.buyerEmail ?? ""}>
                        {r.buyerEmail ?? "—"}
                      </td>
                      <td className={`${td} capitalize`}>{r.tier}</td>
                      <td className={td}>{r.billing}</td>
                      <td className={`${td} whitespace-nowrap tabular-nums`}>{fmtWhen(r.subscriberSince)}</td>
                      <td className={`${td} text-right font-medium tabular-nums`}>
                        {r.isComplimentaryGrant ? "—" : usd(r.estimatedFirstPaymentUsdCents)}
                      </td>
                      <td className={`${td} text-xs text-muted-foreground`}>
                        {r.isComplimentaryGrant ? t("newSubscribers.complimentaryGrant") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {truncNote(`${details.limits.newSubscribers} newest`, details.truncated.newSubscribers)}
        </section>
      ) : showSubs && details.newSubscribers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("newSubscribers.empty")}</p>
      ) : null}

      {showVault && details.vaultPurchases.length > 0 ? (
        <section className={segment === "vault" ? "" : "opacity-95"}>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">{t("vaultPurchases.title")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t("vaultPurchases.subtitle")}</p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border/80 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={th}>{t("vaultPurchases.columns.buyer")}</th>
                    <th className={th}>{tc("email")}</th>
                    <th className={th}>{tc("item")}</th>
                    <th className={`${th} text-right`}>{t("vaultPurchases.columns.amount")}</th>
                    <th className={th}>{tc("when")}</th>
                    <th className={th}>{t("vaultPurchases.columns.paymentRef")}</th>
                  </tr>
                </thead>
                <tbody>
                  {details.vaultPurchases.map((r) => (
                    <tr key={r.id} className="bg-card/40 hover:bg-muted/30">
                      <td className={td}>
                        <span className="font-medium">{r.buyerLabel}</span>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{r.userId}</p>
                      </td>
                      <td className={`${td} max-w-[180px] truncate`} title={r.buyerEmail ?? ""}>
                        {r.buyerEmail ?? "—"}
                      </td>
                      <td className={td}>
                        <span className="font-medium">{r.itemTitle}</span>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{t("vaultPurchases.itemId", { id: r.itemId })}</p>
                      </td>
                      <td className={`${td} text-right font-medium tabular-nums`}>{usd(r.priceUsdCents)}</td>
                      <td className={`${td} whitespace-nowrap tabular-nums`}>{fmtWhen(r.createdAt)}</td>
                      <td className={`${td} max-w-[140px] truncate font-mono text-xs`} title={r.paymentRef ?? ""}>
                        {r.paymentRef ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {truncNote(`${details.limits.vaultPurchases} most recent`, details.truncated.vaultPurchases)}
        </section>
      ) : showVault && details.vaultPurchases.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("vaultPurchases.empty")}</p>
      ) : null}

      {showPayg && paygFiltered.length > 0 ? (
        <section className={segment === "lawyer_searches" || segment === "library_pdf" ? "" : "opacity-95"}>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">{t("payg.title")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("payg.subtitle")}
            {segment === "lawyer_searches" ? ` ${t("payg.filteredLawyerSearch")}` : null}
            {segment === "library_pdf" ? ` ${t("payg.filteredLibraryPdf")}` : null}
          </p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border/80 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={th}>{t("payg.columns.buyer")}</th>
                    <th className={th}>{tc("email")}</th>
                    <th className={th}>{t("payg.columns.product")}</th>
                    <th className={`${th} text-right`}>{t("payg.columns.qty")}</th>
                    <th className={`${th} text-right`}>{t("payg.columns.lineTotal")}</th>
                    <th className={th}>{tc("when")}</th>
                    <th className={th}>{t("payg.columns.paymentRef")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paygFiltered.map((r) => (
                    <tr key={r.id} className="bg-card/40 hover:bg-muted/30">
                      <td className={td}>
                        <span className="font-medium">{r.buyerLabel}</span>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{r.userId}</p>
                      </td>
                      <td className={`${td} max-w-[180px] truncate`} title={r.buyerEmail ?? ""}>
                        {r.buyerEmail ?? "—"}
                      </td>
                      <td className={td}>
                        <span className="font-medium">{r.productLabel}</span>
                        <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">{r.itemType.replace(/_/g, " ")}</p>
                      </td>
                      <td className={`${td} text-right tabular-nums`}>{r.quantity}</td>
                      <td className={`${td} text-right font-medium tabular-nums`}>{usd(r.lineUsdCents)}</td>
                      <td className={`${td} whitespace-nowrap tabular-nums`}>{fmtWhen(r.createdAt)}</td>
                      <td className={`${td} max-w-[140px] truncate font-mono text-xs`} title={r.paymentRef ?? ""}>
                        {r.paymentRef ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {truncNote(`${details.limits.payAsYouGo} most recent`, details.truncated.payAsYouGo)}
        </section>
      ) : showPayg && paygFiltered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {segment === "lawyer_searches"
            ? t("payg.emptyLawyerSearch")
            : segment === "library_pdf"
              ? t("payg.emptyLibraryPdf")
              : t("payg.empty")}
        </p>
      ) : null}
    </div>
  );
}
