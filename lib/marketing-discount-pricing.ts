/** Display-only: platform PAYG/subscription prices show this discount; checkout unchanged. */
export const PLATFORM_MARKETING_DISCOUNT_PERCENT = 25;

/** Strikethrough list price so current = list × (1 − discount%). */
export function marketingListPriceCentsFromCurrent(currentCents: number): number {
  if (currentCents <= 0) return 0;
  const factor = 1 - PLATFORM_MARKETING_DISCOUNT_PERCENT / 100;
  return Math.round(currentCents / factor);
}

export function marketingListPriceUsdFromCurrent(currentUsd: number): number {
  if (currentUsd <= 0) return 0;
  const factor = 1 - PLATFORM_MARKETING_DISCOUNT_PERCENT / 100;
  return Math.round(currentUsd / factor);
}

/** Marketing UI: whole dollars only (decimals rounded). */
export function formatMarketingDisplayUsdFromCents(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

export function formatMarketingDisplayUsdFromDollars(usd: number): string {
  return `$${Math.round(usd)}`;
}

export function formatMarketingListPriceUsd(cents: number): string {
  return formatMarketingDisplayUsdFromCents(marketingListPriceCentsFromCurrent(cents));
}

export function formatMarketingListPriceUsdFromDollars(usd: number): string {
  return formatMarketingDisplayUsdFromDollars(marketingListPriceUsdFromCurrent(usd));
}
