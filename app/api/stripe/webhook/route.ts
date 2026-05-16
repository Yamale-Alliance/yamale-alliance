/**
 * Legacy Stripe-era webhook path. Yamalé uses pawaPay/Lomi — not Stripe.
 * pawaPay callbacks may still POST here; handler is shared with `/api/lomi/webhook`.
 */
export { POST } from "@/app/api/lomi/webhook/route";

export const runtime = "nodejs";
