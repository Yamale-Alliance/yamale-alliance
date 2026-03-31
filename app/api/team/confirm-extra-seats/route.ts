import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getDepositStatus, isDepositCompleted } from "@/lib/pawapay";

/** After pawaPay redirect: confirm team extra seats payment and update Clerk metadata. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = body.session_id as string | undefined;
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const deposit = await getDepositStatus(sessionId);
    if (!deposit || !isDepositCompleted(deposit.status)) {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const clerkUserId = deposit.metadata?.clerk_user_id;
    if (clerkUserId !== userId) {
      return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
    }

    if (deposit.metadata?.kind !== "team_extra_seats" || !deposit.metadata?.seats) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }

    const seats = Number(deposit.metadata.seats);
    if (seats <= 0) return NextResponse.json({ error: "Invalid seats" }, { status: 400 });

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const current = (existing.team_extra_seats as number) ?? 0;
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { ...existing, team_extra_seats: current + seats },
    });

    return NextResponse.json({ ok: true, seatsAdded: seats });
  } catch (err) {
    console.error("Confirm team extra seats error:", err);
    return NextResponse.json({ error: "Failed to confirm" }, { status: 500 });
  }
}
