import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

export const stripe = new Stripe(secret, {
  typescript: true,
});

const PLACEHOLDER_PRICE = "price_...";

/** Map subscription plan id + interval to Stripe Price ID from env */
export function getStripePriceId(planId: string, interval: "monthly" | "annual"): string | null {
  const key =
    interval === "annual"
      ? `STRIPE_PRICE_${planId.toUpperCase()}_ANNUAL`
      : `STRIPE_PRICE_${planId.toUpperCase()}_MONTHLY`;
  const value = process.env[key] ?? null;
  if (!value || value === PLACEHOLDER_PRICE) return null;
  return value;
}

/** One-time price for 24-hour day pass */
export function getStripeDayPassPriceId(): string | null {
  const value = process.env.STRIPE_PRICE_DAY_PASS ?? null;
  if (!value || value === PLACEHOLDER_PRICE) return null;
  return value;
}
