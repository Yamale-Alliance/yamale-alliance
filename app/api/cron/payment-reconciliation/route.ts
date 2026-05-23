import { NextRequest, NextResponse } from "next/server";
import { unauthorizedCronResponse, verifyCronRequest } from "@/lib/cron-auth";
import { runPaymentReconciliation } from "@/lib/payment-reconciliation";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron: reconcile stuck checkouts and stale refunds.
 * Schedule in vercel.json; set CRON_SECRET in Vercel (sent as Authorization: Bearer …).
 *
 * Manual: curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/payment-reconciliation
 */
export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedCronResponse();
  }

  try {
    const report = await runPaymentReconciliation();
    console.info("[cron] payment-reconciliation", report);
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error("[cron] payment-reconciliation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reconciliation failed" },
      { status: 500 }
    );
  }
}
