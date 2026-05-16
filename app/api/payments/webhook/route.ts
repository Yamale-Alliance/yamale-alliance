/**
 * Legacy payment webhook URL (`/api/payments/webhook`).
 * Same handler as `/api/lomi/webhook` (pawaPay deposits + Lomi `PAYMENT_SUCCEEDED`).
 *
 * pawaPay dashboards often still point at `/api/stripe/webhook` (rewritten here via next.config).
 */
export { POST } from "@/app/api/lomi/webhook/route";

export const runtime = "nodejs";
