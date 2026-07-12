import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCheckoutCurrency } from "@/lib/payment-currency";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE } from "@/lib/lomi-marketplace-checkout-cookie";

type PricedLine = {
  currency: string;
  title: string;
  price_cents: number;
  quantity: number;
};

/** POST: create Lomi checkout for marketplace cart. Body: { success_path? } */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    let successPath = "/marketplace";
    const sp = body?.success_path ?? body?.successPath;
    if (typeof sp === "string" && sp.startsWith("/marketplace/") && !sp.startsWith("//") && !sp.includes("://")) {
      const pathOnly = sp.split("?")[0];
      if (pathOnly.length <= 240) successPath = pathOnly;
    }

    const supabase = getSupabaseServer();
    const { data: cartItems, error: cartError } = await supabase
      .from("shopping_cart_items")
      .select(
        `
        marketplace_item_id,
        quantity,
        marketplace_items (
          id,
          title,
          price_cents,
          currency
        )
      `
      )
      .eq("user_id", userId);

    if (cartError || !cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const pricedItems = cartItems
      .map((item: any) => {
        const marketplaceItem = item.marketplace_items;
        if (!marketplaceItem || marketplaceItem.price_cents === 0) return null;
        return {
          currency: (marketplaceItem.currency || getCheckoutCurrency()).toUpperCase(),
          title: marketplaceItem.title as string,
          price_cents: Number(marketplaceItem.price_cents) || 0,
          quantity: item.quantity || 1,
        };
      })
      .filter((x): x is PricedLine => x != null);

    if (pricedItems.length === 0) {
      return NextResponse.json({ error: "No items to checkout" }, { status: 400 });
    }

    const currencies = Array.from(new Set(pricedItems.map((x) => x.currency)));
    if (currencies.length !== 1) {
      return NextResponse.json({ error: "Cart checkout supports one currency at a time" }, { status: 400 });
    }
    const currency = currencies[0];
    const amountCents = pricedItems.reduce((sum, x) => sum + x.price_cents * x.quantity, 0);
    const itemIdsList = cartItems.map((item: any) => item.marketplace_item_id as string);
    const itemIdsCsv = itemIdsList.join(",");
    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const origin = requestOrigin;

    if (!isLomiConfigured()) {
      return NextResponse.json({ error: "Lomi checkout is not configured." }, { status: 503 });
    }

    const currencyCode = toLomiCurrency(currency);
    if (!currencyCode) {
      return NextResponse.json(
        { error: "Lomi checkout supports USD, EUR, or XOF only." },
        { status: 400 }
      );
    }

    if (itemIdsCsv.length > 500) {
      return NextResponse.json({ error: "Cart is too large for hosted checkout metadata." }, { status: 400 });
    }

    const { checkoutUrl, sessionId } = await createLomiHostedCheckoutSession({
      amount: amountCents,
      currency_code: currencyCode,
      metadata: {
        clerk_user_id: userId,
        kind: "marketplace_cart",
        item_ids: itemIdsCsv,
        payment_provider: "lomi",
      },
      title: "The Yamalé Vault cart",
      description: "Marketplace cart checkout",
      success_url: `${origin}${successPath}?payment=verify&from_lomi=1`,
      cancel_url: `${origin}${successPath}?canceled=1`,
    });

    const res = NextResponse.json({ url: checkoutUrl, provider: "lomi" });
    if (sessionId) {
      res.cookies.set(LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE, sessionId, {
        path: "/",
        maxAge: 60 * 30,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return res;
  } catch (err) {
    console.error("Cart checkout error:", err);
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
