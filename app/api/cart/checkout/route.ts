import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

/** POST: create Stripe checkout session for cart items */
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

    // Build line items for Stripe (filter out nulls so type is LineItem[])
    type LineItem = {
      price_data: { currency: string; product_data: { name: string }; unit_amount: number };
      quantity: number;
    };
    const lineItems: LineItem[] = cartItems
      .map((item: any) => {
        const marketplaceItem = item.marketplace_items;
        if (!marketplaceItem || marketplaceItem.price_cents === 0) return null;
        return {
          price_data: {
            currency: marketplaceItem.currency || "usd",
            product_data: {
              name: marketplaceItem.title,
            },
            unit_amount: marketplaceItem.price_cents,
          },
          quantity: item.quantity || 1,
        };
      })
      .filter((x): x is LineItem => x != null);

    if (lineItems.length === 0) {
      return NextResponse.json({ error: "No items to checkout" }, { status: 400 });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${request.headers.get("origin") || ""}/marketplace?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get("origin") || ""}/marketplace`,
      metadata: {
        clerk_user_id: userId,
        kind: "marketplace_cart",
        item_ids: JSON.stringify(cartItems.map((item: any) => item.marketplace_item_id)),
      },
    });

    // Clear cart after successful checkout session creation
    // Note: Actual purchase is recorded via webhook
    await supabase.from("shopping_cart_items").delete().eq("user_id", userId);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Cart checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
