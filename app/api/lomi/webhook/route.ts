import { NextRequest, NextResponse } from "next/server";
import { fulfillPaymentFromMetadata, handlePawaPayDepositWebhook } from "@/lib/payment-webhook-fulfillment";
import { flattenLomiMetadata, verifyLomiWebhookSignature } from "@/lib/lomi-checkout";

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
      const ref = String(payload.data.checkout_session_id ?? payload.data.transaction_id ?? "");
      if (ref && md.clerk_user_id) {
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
    await handlePawaPayDepositWebhook(callback);
  } catch (err) {
    console.error("pawaPay webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
