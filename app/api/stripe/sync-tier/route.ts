import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getDepositStatus, isDepositCompleted } from "@/lib/pawapay";

/** After checkout redirect: set user tier from pawaPay deposit metadata. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = body.session_id as string | undefined;
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 }
      );
    }

    const deposit = await getDepositStatus(sessionId);
    if (!deposit || !isDepositCompleted(deposit.status)) {
      return NextResponse.json(
        { error: "Payment not completed yet" },
        { status: 400 }
      );
    }

    const sessionUserId = deposit.metadata?.clerk_user_id;
    if (sessionUserId !== userId) {
      return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
    }

    const planId = deposit.metadata?.plan_id ?? null;

    if (!planId || !["basic", "pro", "team"].includes(planId)) {
      return NextResponse.json(
        { error: "Could not determine plan from session" },
        { status: 400 }
      );
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const nextMeta: Record<string, unknown> = { ...existing, tier: planId };
    if (planId === "team") {
      nextMeta.team_admin = true;
      nextMeta.team_extra_seats = (existing.team_extra_seats as number) ?? 0;
    }
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: nextMeta,
    });

    return NextResponse.json({ ok: true, tier: planId });
  } catch (err) {
    console.error("pawaPay sync-tier error:", err);
    return NextResponse.json(
      { error: "Failed to sync plan" },
      { status: 500 }
    );
  }
}
