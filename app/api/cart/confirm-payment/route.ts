import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDepositStatus, isDepositCompleted } from "@/lib/pawapay";
import { getCompletedLomiCheckoutMetadata } from "@/lib/lomi-checkout";
import {
  clearUserShoppingCart,
  parseCartItemIdsMetadata,
  recordMarketplaceCartPurchases,
} from "@/lib/marketplace-cart-purchases";

/**
 * After checkout redirect: confirm payment and record purchases.
 * Supports pawaPay deposit IDs and Lomi checkout session IDs.
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

    const lomiMd = await getCompletedLomiCheckoutMetadata(sessionId);
    if (lomiMd) {
      if (lomiMd.clerk_user_id !== userId) {
        return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
      }
      if (lomiMd.kind !== "marketplace_cart") {
        return NextResponse.json({ error: "Not a marketplace cart session" }, { status: 400 });
      }
      const ids = parseCartItemIdsMetadata(lomiMd.item_ids);
      if (ids.length === 0) {
        return NextResponse.json({ error: "No items found in cart session" }, { status: 400 });
      }
      await recordMarketplaceCartPurchases({
        userId,
        itemIds: ids,
        sessionId,
      });
      await clearUserShoppingCart(userId);
      return NextResponse.json({ ok: true, marketplace_item_ids: ids, provider: "lomi" });
    }

    const deposit = await getDepositStatus(sessionId);
    if (!deposit || !isDepositCompleted(deposit.status)) {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const clerkUserId = deposit.metadata?.clerk_user_id;
    if (clerkUserId !== userId) {
      return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
    }

    if (deposit.metadata?.kind !== "marketplace_cart") {
      return NextResponse.json({ error: "Not a marketplace cart session" }, { status: 400 });
    }

    const ids = parseCartItemIdsMetadata(deposit.metadata?.item_ids);
    if (ids.length === 0) {
      return NextResponse.json({ error: "No items found in cart session" }, { status: 400 });
    }

    await recordMarketplaceCartPurchases({
      userId,
      itemIds: ids,
      sessionId,
    });

    return NextResponse.json({ ok: true, marketplace_item_ids: ids, provider: "pawapay" });
  } catch (err) {
    console.error("Cart confirm payment error:", err);
    return NextResponse.json({ error: "Failed to confirm cart payment" }, { status: 500 });
  }
}
