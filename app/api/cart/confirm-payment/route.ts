import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
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
import {
  clearUserShoppingCart,
  parseCartItemIdsMetadata,
  recordMarketplaceCartPurchases,
} from "@/lib/marketplace-cart-purchases";
import { LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE } from "@/lib/lomi-marketplace-checkout-cookie";

/**
 * After checkout redirect: confirm payment and record purchases.
 * pawaPay: `session_id` is the deposit id. Lomi: `payment=verify&from_lomi=1` + HttpOnly cookie (Lomi does not substitute `{CHECKOUT_SESSION_ID}` in success_url).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const fromLomiCookie = body.from_lomi_cookie === true;
    let sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
    const placeholder =
      sessionId === "{CHECKOUT_SESSION_ID}" || decodeURIComponent(sessionId) === "{CHECKOUT_SESSION_ID}";
    if (placeholder) {
      sessionId = "";
    }
    if ((!sessionId || sessionId.length === 0) && fromLomiCookie) {
      const jar = await cookies();
      sessionId = jar.get(LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE)?.value?.trim() ?? "";
    }
    if (!sessionId) {
      return NextResponse.json(
        {
          error: fromLomiCookie
            ? "Checkout return expired or missing. Return from checkout again, or refresh this page."
            : "session_id required",
        },
        { status: 400 }
      );
    }

    const quickPawa = await getDepositStatus(sessionId);

    let lomiMd = await getCompletedLomiCheckoutMetadata(sessionId);
    if (!lomiMd && isLomiConfigured() && !quickPawa) {
      lomiMd = await pollCompletedLomiCheckoutMetadata(sessionId);
    }
    if (lomiMd) {
      const lomiUser = lomiMd.clerk_user_id ?? lomiMd.CLERK_USER_ID;
      if (lomiUser !== userId) {
        const res = NextResponse.json({ error: "Session does not match user" }, { status: 403 });
        res.cookies.set(LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE, "", { path: "/", maxAge: 0 });
        return res;
      }
      const kind = lomiMd.kind ?? lomiMd.KIND;
      if (kind !== "marketplace_cart") {
        const res = NextResponse.json({ error: "Not a marketplace cart session" }, { status: 400 });
        res.cookies.set(LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE, "", { path: "/", maxAge: 0 });
        return res;
      }
      const ids = parseCartItemIdsMetadata(lomiMd.item_ids ?? lomiMd.ITEM_IDS);
      if (ids.length === 0) {
        const res = NextResponse.json({ error: "No items found in cart session" }, { status: 400 });
        res.cookies.set(LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE, "", { path: "/", maxAge: 0 });
        return res;
      }
      await recordMarketplaceCartPurchases({
        userId,
        itemIds: ids,
        sessionId,
      });
      await clearUserShoppingCart(userId);
      const res = NextResponse.json({ ok: true, marketplace_item_ids: ids, provider: "lomi" });
      res.cookies.set(LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
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

    const res = NextResponse.json({ ok: true, marketplace_item_ids: ids, provider: "pawapay" });
    res.cookies.set(LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    console.error("Cart confirm payment error:", err);
    return NextResponse.json({ error: "Failed to confirm cart payment" }, { status: 500 });
  }
}
