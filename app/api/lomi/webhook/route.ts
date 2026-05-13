import { NextRequest, NextResponse } from "next/server";
import { fulfillPaymentFromMetadata, handlePawaPayDepositWebhook } from "@/lib/payment-webhook-fulfillment";
import { flattenLomiMetadata, verifyLomiWebhookSignature } from "@/lib/lomi-checkout";
import crypto from "crypto";

export const runtime = "nodejs";

type LomiWebhookEvent = {
  id?: string;
  event?: string;
  data?: {
    metadata?: unknown;
    checkout_session_id?: string | null;
    transaction_id?: string;
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const lomiSecret = process.env.LOMI_WEBHOOK_SECRET?.trim();
  const lomiSig = request.headers.get("x-lomi-signature");
  if (lomiSecret && lomiSig) {
    if (!verifyLomiWebhookSignature(rawBody, lomiSig, lomiSecret)) {
      return NextResponse.json({ error: "Invalid Lomi webhook signature" }, { status: 400 });
    }
    let payload: LomiWebhookEvent;
    try {
      payload = JSON.parse(rawBody || "{}") as LomiWebhookEvent;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = String(payload.event || "");
    if (eventType === "PAYMENT_SUCCEEDED" && payload.data) {
      const md = flattenLomiMetadata(payload.data.metadata);
      const checkoutId = String(payload.data.checkout_session_id ?? "").trim();
      const txnId = String(payload.data.transaction_id ?? "").trim();
      const kindNorm = String(md.kind || "")
        .trim()
        .toLowerCase()
        .replace(/-/g, "_");
      /** Browser return URL uses checkout session id; Lomi sometimes only echoes transaction id in webhooks — record both. */
      const paygMultiRefKinds = new Set(["payg_document", "payg_ai_query", "payg_afcfta_report"]);
      const refs =
        paygMultiRefKinds.has(kindNorm) && checkoutId && txnId && checkoutId !== txnId
          ? [checkoutId, txnId]
          : [checkoutId || txnId].filter(Boolean);
      for (const ref of refs) {
        if (!ref || !md.clerk_user_id) continue;
        try {
          await fulfillPaymentFromMetadata(md, ref);
        } catch (err) {
          console.error("Lomi webhook fulfillment error:", err);
          return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ received: true });
  }

  let callback: { depositId?: string; status?: string; metadata?: unknown };
  try {
    callback = JSON.parse(rawBody || "{}") as typeof callback;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const expectedWebhookToken = process.env.PAWAPAY_WEBHOOK_TOKEN?.trim();
    if (expectedWebhookToken) {
      const tokenHeader = request.headers.get("x-webhook-token")?.trim() || "";
      const provided = Buffer.from(tokenHeader, "utf8");
      const expected = Buffer.from(expectedWebhookToken, "utf8");
      if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
        return NextResponse.json({ error: "Invalid pawaPay webhook token" }, { status: 401 });
      }
    }

    await handlePawaPayDepositWebhook(callback);
  } catch (err) {
    console.error("pawaPay webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
