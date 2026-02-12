import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: fetch user's cart */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ cart: [] });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("shopping_cart_items")
      .select(
        `
        id,
        marketplace_item_id,
        quantity,
        created_at,
        marketplace_items (
          id,
          title,
          author,
          price_cents,
          currency,
          image_url,
          type
        )
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Cart GET error:", error);
      return NextResponse.json({ error: "Failed to fetch cart" }, { status: 500 });
    }

    // Transform data to flatten marketplace_items
    const cartItems = (data ?? []).map((item: any) => ({
      id: item.id,
      marketplace_item_id: item.marketplace_item_id,
      quantity: item.quantity,
      created_at: item.created_at,
      item: item.marketplace_items,
    }));

    return NextResponse.json({ cart: cartItems });
  } catch (err) {
    console.error("Cart GET error:", err);
    return NextResponse.json({ error: "Failed to fetch cart" }, { status: 500 });
  }
}

/** POST: add item to cart */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const itemId = body.marketplace_item_id as string | undefined;
    const quantity = (body.quantity as number | undefined) ?? 1;

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "marketplace_item_id is required" }, { status: 400 });
    }

    if (quantity < 1) {
      return NextResponse.json({ error: "quantity must be at least 1" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { error } = await (supabase.from("shopping_cart_items") as any).upsert(
      {
        user_id: userId,
        marketplace_item_id: itemId,
        quantity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,marketplace_item_id" }
    );

    if (error) {
      console.error("Cart POST error:", error);
      return NextResponse.json({ error: "Failed to add to cart" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Cart POST error:", err);
    return NextResponse.json({ error: "Failed to add to cart" }, { status: 500 });
  }
}

/** DELETE: remove item from cart */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("item_id");
    if (!itemId) {
      return NextResponse.json({ error: "item_id is required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("shopping_cart_items")
      .delete()
      .eq("user_id", userId)
      .eq("marketplace_item_id", itemId);

    if (error) {
      console.error("Cart DELETE error:", error);
      return NextResponse.json({ error: "Failed to remove from cart" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Cart DELETE error:", err);
    return NextResponse.json({ error: "Failed to remove from cart" }, { status: 500 });
  }
}
