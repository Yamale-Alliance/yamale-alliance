import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createPaymentPageSession } from "@/lib/pawapay";

/** POST: create pawaPay payment page session for cart items */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
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
          currency: (marketplaceItem.currency || process.env.PAWAPAY_CURRENCY || "USD").toUpperCase(),
          title: marketplaceItem.title as string,
          price_cents: Number(marketplaceItem.price_cents) || 0,
          quantity: item.quantity || 1,
        };
      })
      .filter((x): x is { currency: string; title: string; price_cents: number; quantity: number } => x != null);

    if (pricedItems.length === 0) {
      return NextResponse.json({ error: "No items to checkout" }, { status: 400 });
    }

    const currencies = Array.from(new Set(pricedItems.map((x) => x.currency)));
    if (currencies.length > 1) {
      return NextResponse.json({ error: "Cart checkout supports one currency at a time" }, { status: 400 });
    }
    const amountCents = pricedItems.reduce((sum, x) => sum + x.price_cents * x.quantity, 0);
    const depositId = crypto.randomUUID();
    const origin = request.headers.get("origin") || request.nextUrl.origin;

    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents,
      currency: currencies[0] || (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase(),
      returnUrl: `${origin}/marketplace?session_id=${encodeURIComponent(depositId)}`,
      reason: "Marketplace cart",
      customerMessage: "Marketplace cart checkout",
      country: process.env.PAWAPAY_COUNTRY,
      metadata: {
        clerk_user_id: userId,
        kind: "marketplace_cart",
        item_ids: JSON.stringify(cartItems.map((item: any) => item.marketplace_item_id)),
      },
    });

    // Clear cart after successful checkout session creation
    // Note: Actual purchase is recorded via webhook
    await supabase.from("shopping_cart_items").delete().eq("user_id", userId);

    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("Cart checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
