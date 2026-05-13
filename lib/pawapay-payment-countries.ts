/** Display name → pawaPay Payment Page country (ISO 3166-1 alpha-3) + local currency. */
export const PAWAPAY_COUNTRY_BY_NAME: Record<string, { iso3: string; currency: string }> = {
  Benin: { iso3: "BEN", currency: "XOF" },
  Cameroon: { iso3: "CMR", currency: "XAF" },
  "Côte d'Ivoire": { iso3: "CIV", currency: "XOF" },
  "DR Congo": { iso3: "COD", currency: "CDF" },
  /** Legacy label — keep so stored sessions / payloads still resolve. */
  "Democratic Republic of the Congo": { iso3: "COD", currency: "CDF" },
  Gabon: { iso3: "GAB", currency: "XAF" },
  Kenya: { iso3: "KEN", currency: "KES" },
  "Congo Republic": { iso3: "COG", currency: "XAF" },
  /** Legacy label — keep so stored sessions / payloads still resolve. */
  "Republic of the Congo": { iso3: "COG", currency: "XAF" },
  Rwanda: { iso3: "RWA", currency: "RWF" },
  Senegal: { iso3: "SEN", currency: "XOF" },
  "Sierra Leone": { iso3: "SLE", currency: "SLE" },
  Uganda: { iso3: "UGA", currency: "UGX" },
  Zambia: { iso3: "ZMB", currency: "ZMW" },
};

/** Stable order for selects (must match keys in {@link PAWAPAY_COUNTRY_BY_NAME}). */
export const PAWAPAY_SUPPORTED_PAYMENT_COUNTRIES = [
  "Benin",
  "Cameroon",
  "Côte d'Ivoire",
  "DR Congo",
  "Gabon",
  "Kenya",
  "Congo Republic",
  "Rwanda",
  "Senegal",
  "Sierra Leone",
  "Uganda",
  "Zambia",
] as const;

export type PawapayPaymentCountryLabel = (typeof PAWAPAY_SUPPORTED_PAYMENT_COUNTRIES)[number];

/** Default for selects when none chosen yet. */
export const DEFAULT_PAWAPAY_PAYMENT_COUNTRY: string = PAWAPAY_SUPPORTED_PAYMENT_COUNTRIES[0];

export function parsePaymentCountry(body: Record<string, unknown>): string {
  const p = body.paymentCountry;
  return typeof p === "string" ? p.trim() : "";
}

export function resolvePawapayPaymentCountry(label: string): { iso3: string; currency: string; label: string } | null {
  if (!label) return null;
  const cfg = PAWAPAY_COUNTRY_BY_NAME[label];
  if (!cfg) return null;
  return { iso3: cfg.iso3, currency: cfg.currency, label };
}
