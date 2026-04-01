import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!cached) {
    cached = new Stripe(key);
  }
  return cached;
}

export function isStripeSecretConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY?.trim();
}
