import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import {
  getCompletedLomiCheckoutMetadata,
  isLomiConfigured,
  pollCompletedLomiCheckoutMetadata,
} from "@/lib/lomi-checkout";
import { capturePaymentConfirmError } from "@/lib/monitoring";
import {
  clearUserShoppingCart,
  parseCartItemIdsMetadata,
  recordMarketplaceCartPurchases,
} from "@/lib/marketplace-cart-purchases";
import { LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE } from "@/lib/lomi-marketplace-checkout-cookie";

/** After Lomi checkout redirect: confirm payment and record purchases. */
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
  } catch (err) {
    console.error("Cart confirm payment error:", err);
    capturePaymentConfirmError("/api/cart/confirm-payment", err);
    return NextResponse.json({ error: "Failed to confirm cart payment" }, { status: 500 });
  }
}
