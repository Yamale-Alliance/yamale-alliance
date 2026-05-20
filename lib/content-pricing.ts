/** Defaults and helpers for public pay-as-you-go USD prices (stored as cents in platform_settings). */

export const MIN_USD_PRICE_CENTS = 50;
export const MAX_USD_PRICE_CENTS = 99_999;

/** Matches the five cards on /pricing (“Add what you need”). */
export const CONTENT_PRICING_DEFAULTS = {
  lawPrintPriceUsdCents: 300,
  lawyerSearchUnlockPriceUsdCents: 500,
  dayPassPriceUsdCents: 999,
  afcftaReportPriceUsdCents: 1500,
  aiQueryPriceUsdCents: 100,
} as const;

export type ContentPricingSnapshot = {
  lawPrintPriceUsdCents: number;
  lawyerSearchUnlockPriceUsdCents: number;
  dayPassPriceUsdCents: number;
  afcftaReportPriceUsdCents: number;
  aiQueryPriceUsdCents: number;
};

export type ContentPricingKey = keyof ContentPricingSnapshot;

const DB_COLUMN_BY_KEY: Record<ContentPricingKey, string> = {
  lawPrintPriceUsdCents: "law_print_price_usd_cents",
  lawyerSearchUnlockPriceUsdCents: "lawyer_search_unlock_price_usd_cents",
  dayPassPriceUsdCents: "day_pass_price_usd_cents",
  afcftaReportPriceUsdCents: "afcfta_report_price_usd_cents",
  aiQueryPriceUsdCents: "ai_query_price_usd_cents",
};

export function contentPricingDbColumn(key: ContentPricingKey): string {
  return DB_COLUMN_BY_KEY[key];
}

export function clampUsdPriceCents(
  cents: number,
  fallback: number = CONTENT_PRICING_DEFAULTS.lawPrintPriceUsdCents
): number {
  if (!Number.isFinite(cents)) return fallback;
  return Math.min(MAX_USD_PRICE_CENTS, Math.max(MIN_USD_PRICE_CENTS, Math.round(cents)));
}

export function parseUsdPriceInput(value: string): number | null {
  const trimmed = value.trim().replace(/^\$/, "");
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return clampUsdPriceCents(Math.round(n * 100));
}

/** e.g. 300 → "$3", 999 → "$9.99" */
export function formatUsdPrice(cents: number): string {
  const safe = clampUsdPriceCents(cents);
  if (safe % 100 === 0) return `$${safe / 100}`;
  return `$${(safe / 100).toFixed(2)}`;
}

export function readContentPricingFromRow(
  row: Record<string, unknown> | null | undefined
): ContentPricingSnapshot {
  const read = (col: string, key: ContentPricingKey): number => {
    const raw = row?.[col];
    const fallback = CONTENT_PRICING_DEFAULTS[key];
    return typeof raw === "number" && Number.isFinite(raw) ? clampUsdPriceCents(raw, fallback) : fallback;
  };
  return {
    lawPrintPriceUsdCents: read("law_print_price_usd_cents", "lawPrintPriceUsdCents"),
    lawyerSearchUnlockPriceUsdCents: read(
      "lawyer_search_unlock_price_usd_cents",
      "lawyerSearchUnlockPriceUsdCents"
    ),
    dayPassPriceUsdCents: read("day_pass_price_usd_cents", "dayPassPriceUsdCents"),
    afcftaReportPriceUsdCents: read("afcfta_report_price_usd_cents", "afcftaReportPriceUsdCents"),
    aiQueryPriceUsdCents: read("ai_query_price_usd_cents", "aiQueryPriceUsdCents"),
  };
}

export function contentPricingToApiPayload(pricing: ContentPricingSnapshot): Record<string, unknown> {
  return {
    lawPrintPriceUsdCents: pricing.lawPrintPriceUsdCents,
    lawPrintPriceDisplay: formatUsdPrice(pricing.lawPrintPriceUsdCents),
    lawyerSearchUnlockPriceUsdCents: pricing.lawyerSearchUnlockPriceUsdCents,
    lawyerSearchUnlockPriceDisplay: formatUsdPrice(pricing.lawyerSearchUnlockPriceUsdCents),
    dayPassPriceUsdCents: pricing.dayPassPriceUsdCents,
    dayPassPriceDisplay: formatUsdPrice(pricing.dayPassPriceUsdCents),
    afcftaReportPriceUsdCents: pricing.afcftaReportPriceUsdCents,
    afcftaReportPriceDisplay: formatUsdPrice(pricing.afcftaReportPriceUsdCents),
    aiQueryPriceUsdCents: pricing.aiQueryPriceUsdCents,
    aiQueryPriceDisplay: formatUsdPrice(pricing.aiQueryPriceUsdCents),
  };
}

/** Map PATCH body keys (camelCase USD or cents) → DB column updates. */
export function parseContentPricingPatchBody(body: Record<string, unknown>): Partial<ContentPricingSnapshot> {
  const out: Partial<ContentPricingSnapshot> = {};
  const pairs: Array<{
    usdKey: string;
    centsKey: ContentPricingKey;
    field: ContentPricingKey;
  }> = [
    { usdKey: "lawPrintPriceUsd", centsKey: "lawPrintPriceUsdCents", field: "lawPrintPriceUsdCents" },
    {
      usdKey: "lawyerSearchUnlockPriceUsd",
      centsKey: "lawyerSearchUnlockPriceUsdCents",
      field: "lawyerSearchUnlockPriceUsdCents",
    },
    { usdKey: "dayPassPriceUsd", centsKey: "dayPassPriceUsdCents", field: "dayPassPriceUsdCents" },
    {
      usdKey: "afcftaReportPriceUsd",
      centsKey: "afcftaReportPriceUsdCents",
      field: "afcftaReportPriceUsdCents",
    },
    { usdKey: "aiQueryPriceUsd", centsKey: "aiQueryPriceUsdCents", field: "aiQueryPriceUsdCents" },
  ];

  for (const { usdKey, centsKey, field } of pairs) {
    if (typeof body[centsKey] === "number") {
      out[field] = clampUsdPriceCents(body[centsKey] as number, CONTENT_PRICING_DEFAULTS[field]);
    } else if (typeof body[usdKey] === "string") {
      const parsed = parseUsdPriceInput(body[usdKey] as string);
      if (parsed !== null) out[field] = parsed;
    }
  }
  return out;
}
