import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getCompletedLomiCheckoutMetadata,
  isLomiConfigured,
  pollCompletedLomiCheckoutMetadata,
} from "@/lib/lomi-checkout";
import { fulfillPaymentFromMetadata } from "@/lib/payment-webhook-fulfillment";

function isTeamExtraSeatsMetadata(md: Record<string, string>): boolean {
  const kind = String(md.kind || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  return kind === "team_extra_seats";
}

/** After Lomi redirect: confirm team extra seats payment and update Clerk metadata. */
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
    if (!isTeamExtraSeatsMetadata(lomiMd)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }
    const seats = Number(lomiMd.seats);
    if (seats <= 0) return NextResponse.json({ error: "Invalid seats" }, { status: 400 });
    await fulfillPaymentFromMetadata(lomiMd, sessionId);
    return NextResponse.json({ ok: true, seatsAdded: seats, provider: "lomi" });
  } catch (err) {
    console.error("Confirm team extra seats error:", err);
    return NextResponse.json({ error: "Failed to confirm" }, { status: 500 });
  }
}
