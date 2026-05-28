import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getDepositStatus, isDepositCompleted, pollPawaPayDepositUntilComplete } from "@/lib/pawapay";
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

/** After pawaPay / Lomi redirect: confirm team extra seats payment and update Clerk metadata. */
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

    const quickPawa = await getDepositStatus(sessionId);

    let lomiMd = await getCompletedLomiCheckoutMetadata(sessionId);
    if (!lomiMd && isLomiConfigured() && !quickPawa) {
      lomiMd = await pollCompletedLomiCheckoutMetadata(sessionId);
    }
    if (lomiMd) {
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
    }

    let deposit = quickPawa;
    if (!deposit || !isDepositCompleted(deposit.status)) {
      const polled = await pollPawaPayDepositUntilComplete(sessionId, {
        maxAttempts: 20,
        delayMs: 500,
      });
      if (!polled.ok) {
        const status = polled.reason === "pending" ? 503 : 400;
        return NextResponse.json(
          { error: polled.message, pending: polled.reason === "pending" },
          { status }
        );
      }
      deposit = polled.deposit;
    }

    if (deposit.metadata?.clerk_user_id !== userId) {
      return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
    }

    if (deposit.metadata?.kind !== "team_extra_seats" || !deposit.metadata?.seats) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }

    const seats = Number(deposit.metadata.seats);
    if (seats <= 0) return NextResponse.json({ error: "Invalid seats" }, { status: 400 });

    await fulfillPaymentFromMetadata(deposit.metadata, sessionId);

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const current = (existing.team_extra_seats as number) ?? 0;

    return NextResponse.json({
      ok: true,
      seatsAdded: seats,
      teamExtraSeats: current + seats,
      provider: "pawapay",
    });
  } catch (err) {
    console.error("Confirm team extra seats error:", err);
    return NextResponse.json({ error: "Failed to confirm" }, { status: 500 });
  }
}
