import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import type { Database } from "@/lib/database.types";

type MarketplaceItemRow = Database["public"]["Tables"]["marketplace_items"]["Row"];

/**
 * Create Stripe Checkout for a marketplace item.
 * Price is read from DB (not from Stripe product catalog). One-time payment.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json();
    const itemId = body.itemId as string | undefined;
    if (!itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("marketplace_items")
      .select("id, title, description, price_cents, currency")
      .eq("id", itemId)
      .eq("published", true)
      .single();

    const item = data as MarketplaceItemRow | null;
    if (error || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.price_cents <= 0) {
      return NextResponse.json(
        { error: "Free items use Get for free – no checkout" },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: (item.currency || "usd").toLowerCase(),
            unit_amount: item.price_cents,
            product_data: {
              name: item.title,
              description: (item.description || "").slice(0, 500),
              images: [],
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/marketplace/${itemId}?checkout=success`,
      cancel_url: `${origin}/marketplace/${itemId}?checkout=cancelled`,
      client_reference_id: userId,
      metadata: {
        clerk_user_id: userId,
        marketplace_item_id: itemId,
        kind: "marketplace",
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Marketplace checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
