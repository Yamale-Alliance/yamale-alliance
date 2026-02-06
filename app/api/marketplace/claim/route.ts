import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** POST: claim a free marketplace item (no Stripe). */
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
    const { data: item, error: itemError } = await supabase
      .from("marketplace_items")
      .select("id, price_cents, published")
      .eq("id", itemId)
      .eq("published", true)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (item.price_cents > 0) {
      return NextResponse.json(
        { error: "This item is not free. Use Purchase to pay." },
        { status: 400 }
      );
    }

    const { error: upsertError } = await supabase.from("marketplace_purchases").upsert(
      {
        user_id: userId,
        marketplace_item_id: itemId,
        stripe_session_id: null,
      },
      { onConflict: "user_id,marketplace_item_id" }
    );

    if (upsertError) {
      return NextResponse.json({ error: "Failed to claim item" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Marketplace claim error:", err);
    return NextResponse.json({ error: "Failed to claim" }, { status: 500 });
  }
}
