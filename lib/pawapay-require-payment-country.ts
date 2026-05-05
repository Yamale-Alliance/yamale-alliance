import { NextResponse } from "next/server";
import {
  PAWAPAY_SUPPORTED_PAYMENT_COUNTRIES,
  parsePaymentCountry,
  resolvePawapayPaymentCountry,
} from "@/lib/pawapay-payment-countries";

export type PawapayResolvedCountry = { iso3: string; currency: string; label: string };

export function requirePawapayPaymentCountry(
  body: Record<string, unknown>
): { ok: true; country: PawapayResolvedCountry } | { ok: false; response: NextResponse } {
  const label = parsePaymentCountry(body);
  if (!label) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Select a mobile money country to continue." }, { status: 400 }),
    };
  }
  const resolved = resolvePawapayPaymentCountry(label);
  if (!resolved) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Mobile money is not available for “${label}”. Choose one of: ${PAWAPAY_SUPPORTED_PAYMENT_COUNTRIES.join(", ")}`,
        },
        { status: 400 }
      ),
    };
  }
  return { ok: true, country: resolved };
}
