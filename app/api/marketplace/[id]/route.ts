import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";

/** GET: single marketplace item (public). Optionally include purchased=true if user owns it. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: item, error } = await supabase
      .from("marketplace_items")
      .select("id, type, title, author, description, price_cents, currency, image_url, published, sort_order, created_at")
      .eq("id", id)
      .single();

    if (error || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (!item.published) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    let purchased = false;
    const { userId } = await auth();
    if (userId) {
      const { data: purchase } = await supabase
        .from("marketplace_purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("marketplace_item_id", id)
        .maybeSingle();
      purchased = !!purchase;
    }

    return NextResponse.json({ item: { ...item, purchased } });
  } catch (err) {
    console.error("Marketplace item API error:", err);
    return NextResponse.json({ error: "Failed to load item" }, { status: 500 });
  }
}
