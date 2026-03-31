import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDepositStatus, isDepositCompleted } from "@/lib/pawapay";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * After pawaPay redirect: confirm marketplace payment from session_id and record purchase.
 * Call this when the user lands on /marketplace/[id] with session_id so the purchase
 * is applied even if the webhook hasn't run yet.
 */
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

    const kind = deposit.metadata?.kind;
    const marketplaceItemId = deposit.metadata?.marketplace_item_id;
    if (kind !== "marketplace" || !marketplaceItemId) {
      return NextResponse.json({ error: "Not a marketplace session" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    await (supabase.from("marketplace_purchases") as any).upsert(
      {
        user_id: userId,
        marketplace_item_id: marketplaceItemId,
        stripe_session_id: sessionId,
      },
      { onConflict: "user_id,marketplace_item_id" }
    );

    return NextResponse.json({ ok: true, marketplace_item_id: marketplaceItemId });
  } catch (err) {
    console.error("Marketplace confirm payment error:", err);
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
