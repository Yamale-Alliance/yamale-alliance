export type AnalyticsSegment =
  | "all"
  | "subscriptions"
  | "lawyer_searches"
  | "library_pdf"
  | "vault";

const SEGMENT_SET = new Set<AnalyticsSegment>([
  "all",
  "subscriptions",
  "lawyer_searches",
  "library_pdf",
  "vault",
]);

export function isAnalyticsSegment(s: string): s is AnalyticsSegment {
  return SEGMENT_SET.has(s as AnalyticsSegment);
}

export function parseAnalyticsSegment(raw: string | null | undefined): AnalyticsSegment {
  const t = String(raw ?? "").trim();
  return isAnalyticsSegment(t) ? t : "all";
}

export type AnalyticsRevenueBreakdown = {
  subscriptions: { estimatedNewSubscriberRevenueUsdCents: number };
  lawyerSearches: { revenueUsdCents: number };
  documentUnlocks: { revenueUsdCents: number };
  vaultPurchases: { revenueUsdCents: number };
  totals: {
    transactionRevenueUsdCents: number;
    combinedPeriodRevenueUsdCents?: number;
  };
};

/** Revenue attributed to the selected segment for the current date window (estimates; see disclaimer). */
export function getSegmentRevenueUsdCents(segment: AnalyticsSegment, data: AnalyticsRevenueBreakdown): number {
  switch (segment) {
    case "all":
      return (
        data.totals.combinedPeriodRevenueUsdCents ??
        data.subscriptions.estimatedNewSubscriberRevenueUsdCents + data.totals.transactionRevenueUsdCents
      );
    case "subscriptions":
      return data.subscriptions.estimatedNewSubscriberRevenueUsdCents;
    case "lawyer_searches":
      return data.lawyerSearches.revenueUsdCents;
    case "library_pdf":
      return data.documentUnlocks.revenueUsdCents;
    case "vault":
      return data.vaultPurchases.revenueUsdCents;
  }
}

export const ANALYTICS_SEGMENT_OPTIONS: { value: AnalyticsSegment; label: string; short: string }[] = [
  { value: "all", label: "All sources", short: "All" },
  { value: "subscriptions", label: "AI subscriptions", short: "AI plans" },
  { value: "lawyer_searches", label: "Lawyer search unlocks", short: "Lawyer search" },
  { value: "library_pdf", label: "Library PDF unlocks", short: "Library PDF" },
  { value: "vault", label: "Yamalé Vault", short: "Vault" },
];
