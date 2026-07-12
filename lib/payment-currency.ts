/** Default checkout currency (USD unless overridden). */
export function getCheckoutCurrency(): string {
  return (process.env.CHECKOUT_CURRENCY || process.env.PAWAPAY_CURRENCY || "USD").toUpperCase();
}

/**
 * Convert a USD-cent amount (platform base pricing) into minor units of the
 * target checkout currency.
 *
 * - If currency is USD, returns the input unchanged.
 * - Otherwise requires CHECKOUT_USD_EXCHANGE_RATE (target currency per 1 USD).
 */
export function convertUsdCentsToMinor(usdCents: number, currencyInput?: string): number {
  const currency = (currencyInput || getCheckoutCurrency()).toUpperCase();
  if (currency === "USD") return usdCents;

  const specificRateKey = `CHECKOUT_USD_EXCHANGE_RATE_${currency}`;
  const legacyRateKey = `PAWAPAY_USD_EXCHANGE_RATE_${currency}`;
  const rateRaw =
    process.env[specificRateKey] ??
    process.env[legacyRateKey] ??
    process.env.CHECKOUT_USD_EXCHANGE_RATE ??
    process.env.PAWAPAY_USD_EXCHANGE_RATE;
  const rate = Number(rateRaw);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      `Missing/invalid ${specificRateKey} (or CHECKOUT_USD_EXCHANGE_RATE) for currency ${currency}. ` +
        "Set target-per-USD rate (e.g. 130 for KES)."
    );
  }

  return Math.max(1, Math.round(usdCents * rate));
}
