import {
  clampUsdPriceCents,
  CONTENT_PRICING_DEFAULTS,
  formatUsdPrice,
  parseUsdPriceInput,
} from "@/lib/content-pricing";

/** Default list price for one law PDF print/unlock (USD cents). */
export const DEFAULT_LAW_PRINT_PRICE_USD_CENTS = CONTENT_PRICING_DEFAULTS.lawPrintPriceUsdCents;

export const MIN_LAW_PRINT_PRICE_USD_CENTS = 50;
export const MAX_LAW_PRINT_PRICE_USD_CENTS = 99_999;

export function clampLawPrintPriceUsdCents(cents: number): number {
  return clampUsdPriceCents(cents, DEFAULT_LAW_PRINT_PRICE_USD_CENTS);
}

export function parseLawPrintPriceUsdInput(value: string): number | null {
  return parseUsdPriceInput(value);
}

export function formatLawPrintPriceUsd(cents: number): string {
  return formatUsdPrice(cents);
}
