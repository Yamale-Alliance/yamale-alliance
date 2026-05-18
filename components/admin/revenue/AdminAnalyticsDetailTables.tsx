"use client";

import type { AnalyticsSegment } from "@/lib/admin-analytics-segment";

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
        Showing up to {label} in this window; more rows exist — narrow the date range or use the dedicated tabs for full
        lists.
      </p>
    ) : null;

  return (
    <div className="space-y-10">
      {showSubs && details.newSubscribers.length > 0 ? (
        <section className={segment === "subscriptions" ? "" : "opacity-95"}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">New paid subscribers (in this window)</h3>
            <p className="text-xs text-muted-foreground">
              First billing cycle estimate · includes complimentary grants at $0
            </p>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border/80 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={th}>Who</th>
                    <th className={th}>Email</th>
                    <th className={th}>Plan</th>
                    <th className={th}>Billing</th>
                    <th className={th}>Subscriber since</th>
                    <th className={`${th} text-right`}>Est. first payment</th>
                    <th className={th}>Note</th>
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
                        {r.isComplimentaryGrant ? "Complimentary grant" : "—"}
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
        <p className="text-sm text-muted-foreground">No new paid subscribers in this date window.</p>
      ) : null}

      {showVault && details.vaultPurchases.length > 0 ? (
        <section className={segment === "vault" ? "" : "opacity-95"}>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">Yamalé Vault — who bought what</h3>
          <p className="mt-1 text-xs text-muted-foreground">Item title and list price at time of purchase (from catalog)</p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border/80 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={th}>Buyer</th>
                    <th className={th}>Email</th>
                    <th className={th}>Item</th>
                    <th className={`${th} text-right`}>Amount</th>
                    <th className={th}>When</th>
                    <th className={th}>Payment ref.</th>
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
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Item ID · {r.itemId}</p>
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
        <p className="text-sm text-muted-foreground">No Vault purchases in this date window.</p>
      ) : null}

      {showPayg && paygFiltered.length > 0 ? (
        <section className={segment === "lawyer_searches" || segment === "library_pdf" ? "" : "opacity-95"}>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">One-time unlocks &amp; pay-as-you-go</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Library PDFs, lawyer search, AI query packs, AfCFTA — line amounts use the same list prices as the summary
            cards
            {segment === "lawyer_searches" ? " (filtered to lawyer search)" : null}
            {segment === "library_pdf" ? " (filtered to library PDF)" : null}
          </p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border/80 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={th}>Buyer</th>
                    <th className={th}>Email</th>
                    <th className={th}>Product</th>
                    <th className={`${th} text-right`}>Qty</th>
                    <th className={`${th} text-right`}>Line total</th>
                    <th className={th}>When</th>
                    <th className={th}>Payment ref.</th>
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
            ? "No lawyer search unlocks in this date window."
            : segment === "library_pdf"
              ? "No library PDF unlocks in this date window."
              : "No pay-as-you-go rows in this date window."}
        </p>
      ) : null}
    </div>
  );
}
