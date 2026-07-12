import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  getCompletedLomiCheckoutMetadata,
  isLomiConfigured,
  pollCompletedLomiCheckoutMetadata,
} from "@/lib/lomi-checkout";
import { fulfillPaymentFromMetadata } from "@/lib/payment-webhook-fulfillment";
import { capturePaymentConfirmError } from "@/lib/monitoring";

function isDayPassMetadata(md: Record<string, string>): boolean {
  const kind = String(md.kind || "")
    .trim()
    .toLowerCase();
  const planId = String(md.plan_id || "")
    .trim()
    .toLowerCase();
  return kind === "day-pass" || planId === "day-pass";
}

async function readDayPassExpiresAt(userId: string): Promise<string | null> {
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const raw = (user.publicMetadata as Record<string, unknown>)?.day_pass_expires_at;
  return typeof raw === "string" ? raw : null;
}

/** After Lomi redirect for a 24-hour day pass: confirm payment and grant access. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
    const placeholder =
      sessionId === "{CHECKOUT_SESSION_ID}" || decodeURIComponent(sessionId) === "{CHECKOUT_SESSION_ID}";
    if (placeholder) sessionId = "";
    if (!sessionId) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    let lomiMd = await getCompletedLomiCheckoutMetadata(sessionId);
    if (!lomiMd && isLomiConfigured()) {
      lomiMd = await pollCompletedLomiCheckoutMetadata(sessionId);
    }
    if (!lomiMd) {
      return NextResponse.json(
        {
          error:
            "We could not confirm payment yet. If you finished checkout, wait a few seconds and refresh this page.",
          pending: true,
        },
        { status: 503 }
      );
    }

    if (lomiMd.clerk_user_id !== userId) {
      return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
    }
    if (!isDayPassMetadata(lomiMd)) {
      return NextResponse.json({ error: "Not a day pass session" }, { status: 400 });
    }
    await fulfillPaymentFromMetadata(lomiMd, sessionId);
    const expiresAt = (await readDayPassExpiresAt(userId)) ?? undefined;
    return NextResponse.json({ ok: true, kind: "day_pass", expiresAt, provider: "lomi" });
  } catch (err) {
    console.error("confirm-day-pass error:", err);
    capturePaymentConfirmError("/api/payments/confirm-day-pass", err);
    return NextResponse.json({ error: "Failed to confirm day pass payment" }, { status: 500 });
  }
}
