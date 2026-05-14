import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getDepositStatus,
  isDepositCompleted,
  pollPawaPayDepositUntilComplete,
} from "@/lib/pawapay";
import {
  getCompletedLomiCheckoutMetadata,
  isLomiConfigured,
  pollCompletedLomiCheckoutMetadata,
} from "@/lib/lomi-checkout";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * After Lomi or pawaPay redirect: confirm payment from session_id and record purchase.
 * Call when the user lands on /marketplace/[id] with payment=verify&session_id=…
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

    const quickPawa = await getDepositStatus(sessionId);

    let lomiMd = await getCompletedLomiCheckoutMetadata(sessionId);
    if (!lomiMd && isLomiConfigured() && !quickPawa) {
      lomiMd = await pollCompletedLomiCheckoutMetadata(sessionId);
    }
    if (lomiMd) {
      const lomiUser = lomiMd.clerk_user_id ?? lomiMd.CLERK_USER_ID;
      if (lomiUser !== userId) {
        return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
      }
      const kind = lomiMd.kind ?? lomiMd.KIND;
      const marketplaceItemId = lomiMd.marketplace_item_id ?? lomiMd.MARKETPLACE_ITEM_ID;
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

      return NextResponse.json({ ok: true, marketplace_item_id: marketplaceItemId, provider: "lomi" });
    }

    let deposit = quickPawa;
    if (!deposit || !isDepositCompleted(deposit.status)) {
      const polled = await pollPawaPayDepositUntilComplete(sessionId, {
        maxAttempts: 16,
        delayMs: 500,
      });
      if (!polled.ok) {
        const status = polled.reason === "pending" ? 503 : 400;
        let msg = polled.message || "Payment not completed";
        if (!quickPawa && isLomiConfigured()) {
          msg +=
            " If you paid with card (Lomi), wait a few seconds and refresh this page; the charge can show in your bank before Lomi marks the checkout as paid.";
        }
        return NextResponse.json(
          {
            error: msg,
            pending: polled.reason === "pending",
          },
          { status }
        );
      }
      deposit = polled.deposit;
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
