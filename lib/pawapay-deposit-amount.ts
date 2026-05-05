import { convertUsdCentsToPawapayMinor } from "@/lib/pawapay";

/**
 * Map a stored line amount (minor units of `storedCurrency`) into minor units of
 * the mobile-money wallet currency for the selected country.
 */
export function amountMinorForPawapayCountry(
  amountInStoredCurrencyMinor: number,
  storedCurrency: string,
  walletCurrency: string
): number {
  const s = storedCurrency.toUpperCase();
  const w = walletCurrency.toUpperCase();
  if (s === w) return Math.round(amountInStoredCurrencyMinor);
  if (s === "USD") return convertUsdCentsToPawapayMinor(amountInStoredCurrencyMinor, w);
  throw new Error(
    `This purchase is priced in ${storedCurrency}. The selected mobile money country uses ${walletCurrency}. Try card checkout or contact support.`
  );
}
