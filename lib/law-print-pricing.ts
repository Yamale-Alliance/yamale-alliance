/** Default list price for one law PDF print/unlock (USD cents). */
export const DEFAULT_LAW_PRINT_PRICE_USD_CENTS = 300;

export const MIN_LAW_PRINT_PRICE_USD_CENTS = 50;
export const MAX_LAW_PRINT_PRICE_USD_CENTS = 99_999;

export function clampLawPrintPriceUsdCents(cents: number): number {
  if (!Number.isFinite(cents)) return DEFAULT_LAW_PRINT_PRICE_USD_CENTS;
  return Math.min(MAX_LAW_PRINT_PRICE_USD_CENTS, Math.max(MIN_LAW_PRINT_PRICE_USD_CENTS, Math.round(cents)));
}

export function parseLawPrintPriceUsdInput(value: string): number | null {
  const trimmed = value.trim().replace(/^\$/, "");
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return clampLawPrintPriceUsdCents(Math.round(n * 100));
}

/** e.g. 300 → "$3", 250 → "$2.50" */
export function formatLawPrintPriceUsd(cents: number): string {
  const safe = clampLawPrintPriceUsdCents(cents);
  if (safe % 100 === 0) return `$${safe / 100}`;
  return `$${(safe / 100).toFixed(2)}`;
}
