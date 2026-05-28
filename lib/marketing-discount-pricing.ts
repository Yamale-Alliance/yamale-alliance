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
  return currentUsd / factor;
}

/** Whole-dollar list price for UI; always strictly above rounded current when discounted. */
export function marketingListPriceDisplayDollarsFromCents(currentCents: number): number {
  const currentDollars = Math.round(currentCents / 100);
  if (currentDollars <= 0) return 0;
  const listDollars = Math.ceil(marketingListPriceCentsFromCurrent(currentCents) / 100);
  return Math.max(listDollars, currentDollars + 1);
}

export function marketingListPriceDisplayDollarsFromUsd(currentUsd: number): number {
  const currentDollars = Math.round(currentUsd);
  if (currentDollars <= 0) return 0;
  const listDollars = Math.ceil(marketingListPriceUsdFromCurrent(currentUsd));
  return Math.max(listDollars, currentDollars + 1);
}

/** Marketing UI: whole dollars only (decimals rounded). */
export function formatMarketingDisplayUsdFromCents(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

export function formatMarketingDisplayUsdFromDollars(usd: number): string {
  return `$${Math.round(usd)}`;
}

export function formatMarketingListPriceUsd(cents: number): string {
  return `$${marketingListPriceDisplayDollarsFromCents(cents)}`;
}

export function formatMarketingListPriceUsdFromDollars(usd: number): string {
  return `$${marketingListPriceDisplayDollarsFromUsd(usd)}`;
}
