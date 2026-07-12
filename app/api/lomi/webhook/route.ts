import { NextRequest, NextResponse } from "next/server";
import { fulfillPaymentFromMetadata } from "@/lib/payment-webhook-fulfillment";
import { getSupabaseServer } from "@/lib/supabase/server";
import { markRefundCompletedIfProcessing } from "@/lib/refund-request-claims";
import { lomiWebhookEventId, runIdempotentPaymentWebhook } from "@/lib/payment-webhook-idempotency";
import { flattenLomiMetadata, verifyLomiWebhookSignature } from "@/lib/lomi-checkout";
import { captureWebhookError } from "@/lib/monitoring";

/**
 * Lomi merchant webhooks (outbound POST from Lomi to you):
 * - Security: `X-Lomi-Signature` = HMAC-SHA256(raw body, webhook secret `whsec_…`). No `X-API-Key` on delivery.
 * - Respond with `2xx` quickly (~4s timeout per attempt); work can be deferred. Deliveries may retry; keep idempotent.
 * @see https://docs.lomi.africa/reference/payments/webhooks
 * @see https://docs.lomi.africa/reference/setup/integration
 */

export const runtime = "nodejs";

type LomiWebhookEvent = {
  id?: string;
  event?: string;
  data?: {
    metadata?: unknown;
    checkout_session_id?: string | null;
    transaction_id?: string;
    refund_id?: string;
    id?: string;
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const lomiSecret = process.env.LOMI_WEBHOOK_SECRET?.trim();
  const lomiSig = request.headers.get("X-Lomi-Signature");
  if (!lomiSecret || !lomiSig) {
    return NextResponse.json({ error: "Missing Lomi webhook signature" }, { status: 401 });
  }
  if (!verifyLomiWebhookSignature(rawBody, lomiSig, lomiSecret)) {
    return NextResponse.json({ error: "Invalid Lomi webhook signature" }, { status: 401 });
  }

  let payload: LomiWebhookEvent;
  try {
    payload = JSON.parse(rawBody || "{}") as LomiWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = String(payload.event || "");
  if (eventType === "test.webhook") {
    return NextResponse.json({ received: true });
  }

  const refundEventTypes = new Set([
    "REFUND_SUCCEEDED",
    "REFUND_COMPLETED",
    "refund.succeeded",
    "refund.completed",
  ]);
  if (refundEventTypes.has(eventType) && payload.data) {
    const refundId = String(payload.data.refund_id ?? payload.data.id ?? "").trim();
    const eventId =
      lomiWebhookEventId({
        id: payload.id,
        event: eventType,
        transaction_id: refundId,
      }) || (refundId ? `refund:${refundId}:${eventType}` : "");

    if (eventId && refundId) {
      try {
        await runIdempotentPaymentWebhook(
          {
            provider: "lomi",
            eventId,
            eventType,
            paymentRef: refundId,
          },
          async () => {
            const supabase = getSupabaseServer();
            const { data: row } = await (supabase.from("refund_requests") as any)
              .select("id")
              .or(`provider_refund_id.eq.${refundId},id.eq.${refundId}`)
              .maybeSingle();
            if (row?.id) await markRefundCompletedIfProcessing(supabase, row.id);
          }
        );
      } catch (err) {
        console.error("Lomi refund webhook error:", err);
        captureWebhookError("lomi", err, { eventType, refundId });
        return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
      }
    }
    return NextResponse.json({ received: true });
  }

  if (eventType === "PAYMENT_SUCCEEDED" && payload.data) {
    const md = flattenLomiMetadata(payload.data.metadata);
    const checkoutId = String(payload.data.checkout_session_id ?? "").trim();
    const txnId = String(payload.data.transaction_id ?? "").trim();
    const eventId = lomiWebhookEventId({
      id: payload.id,
      event: eventType,
      checkout_session_id: checkoutId,
      transaction_id: txnId,
    });

    if (!eventId) {
      console.warn("Lomi PAYMENT_SUCCEEDED without event id — skipping fulfillment");
      return NextResponse.json({ received: true });
    }

    try {
      await runIdempotentPaymentWebhook(
        {
          provider: "lomi",
          eventId,
          eventType,
          paymentRef: checkoutId || txnId || null,
        },
        async () => {
          const kindNorm = String(md.kind || "")
            .trim()
            .toLowerCase()
            .replace(/-/g, "_");
          const paygMultiRefKinds = new Set(["payg_document", "payg_ai_query", "payg_afcfta_report"]);
          const refs =
            paygMultiRefKinds.has(kindNorm) && checkoutId && txnId && checkoutId !== txnId
              ? [checkoutId, txnId]
              : [checkoutId || txnId].filter(Boolean);
          for (const ref of refs) {
            if (!ref || !md.clerk_user_id) continue;
            await fulfillPaymentFromMetadata(md, ref);
          }
        }
      );
    } catch (err) {
      console.error("Lomi webhook fulfillment error:", err);
      captureWebhookError("lomi", err, { eventType, checkoutId, txnId });
      return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
