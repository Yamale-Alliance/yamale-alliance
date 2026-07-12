/**
 * Legacy payment webhook URL (`/api/payments/webhook`).
 * Same handler as `/api/lomi/webhook` (Lomi deposits + Lomi `PAYMENT_SUCCEEDED`).
 *
 * Lomi dashboards often still point at `/api/stripe/webhook` (rewritten here via next.config).
 */
export { POST } from "@/app/api/lomi/webhook/route";

export const runtime = "nodejs";
