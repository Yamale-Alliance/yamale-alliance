import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createPaymentPageSession } from "@/lib/pawapay";
import { getStripe, isStripeSecretConfigured } from "@/lib/stripe-server";

type PricedLine = {
  currency: string;
  title: string;
  price_cents: number;
  quantity: number;
};

/** POST: create checkout — pawaPay (mobile money) or Stripe (cards). Body: { provider?: "pawapay" | "stripe" } */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    let provider: "pawapay" | "stripe" = "pawapay";
    try {
      const body = await request.json().catch(() => ({}));
      if (body?.provider === "stripe" || body?.provider === "pawapay") {
        provider = body.provider;
      }
    } catch {
      // no body
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
    const itemIdsJson = JSON.stringify(itemIdsList);
    const origin = request.headers.get("origin") || request.nextUrl.origin;

    if (provider === "stripe") {
      if (!isStripeSecretConfigured()) {
        return NextResponse.json(
          { error: "Card checkout is not configured. Add STRIPE_SECRET_KEY or choose mobile money." },
          { status: 503 }
        );
      }

      const stripe = getStripe();
      const lineItems = pricedItems.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: line.price_cents,
          product_data: {
            name: line.title.slice(0, 120),
          },
        },
      }));

      if (itemIdsCsv.length > 500) {
        return NextResponse.json(
          { error: "Cart is too large for card checkout. Remove some items or use mobile money." },
          { status: 400 }
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        client_reference_id: userId,
        metadata: {
          clerk_user_id: userId,
          kind: "marketplace_cart",
          item_ids: itemIdsCsv,
        },
        success_url: `${origin}/marketplace?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/marketplace/cart?canceled=1`,
        payment_method_types: ["card"],
      });

      // Do not clear cart until payment succeeds (webhook or confirm-payment).
      return NextResponse.json({ url: session.url, provider: "stripe" });
    }

    // pawaPay (default)
    const depositId = crypto.randomUUID();
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents,
      currency,
      returnUrl: `${origin}/marketplace?session_id=${encodeURIComponent(depositId)}`,
      reason: "The Yamale Vault cart",
      customerMessage: "The Yamale Vault cart checkout",
      country: process.env.PAWAPAY_COUNTRY,
      metadata: {
        clerk_user_id: userId,
        kind: "marketplace_cart",
        item_ids: itemIdsJson,
      },
    });

    await supabase.from("shopping_cart_items").delete().eq("user_id", userId);

    return NextResponse.json({ url: redirectUrl, provider: "pawapay" });
  } catch (err) {
    console.error("Cart checkout error:", err);
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
