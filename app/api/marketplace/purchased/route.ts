import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: list all purchased marketplace items for the authenticated user. */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    
    // Get all purchases for the user
    const { data: purchases, error: purchasesError } = await (supabase.from("marketplace_purchases") as any)
      .select("marketplace_item_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (purchasesError) {
      console.error("Purchased items error:", purchasesError);
      return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
    }

    if (!purchases || purchases.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Get item details for purchased items
    const purchaseRows = purchases as Array<{ marketplace_item_id: string; created_at: string }>;
    const itemIds = purchaseRows.map((p) => p.marketplace_item_id);
    const { data: items, error: itemsError } = await (supabase.from("marketplace_items") as any)
      .select("id, type, title, author, description, price_cents, currency, image_url, sort_order, file_path, file_name, file_format")
      .in("id", itemIds)
      .eq("published", true);

    if (itemsError) {
      console.error("Purchased items error:", itemsError);
      return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
    }

    // Map purchases to items with purchase date
    const purchaseMap = new Map(
      purchaseRows.map((p) => [p.marketplace_item_id, p.created_at])
    );

    type ItemRow = {
      id: string;
      type: string;
      title: string;
      author: string;
      description: string | null;
      price_cents: number;
      currency: string;
      image_url: string | null;
      sort_order: number;
      file_path: string | null;
      file_name: string | null;
      file_format: string | null;
    };

    const itemRows = (items ?? []) as ItemRow[];
    const itemsWithPurchaseDate = itemRows.map((item) => ({
      ...item,
      purchased: true,
      purchased_at: purchaseMap.get(item.id) ?? new Date().toISOString(),
      has_file: !!item.file_path,
    }));

    return NextResponse.json({ items: itemsWithPurchaseDate });
  } catch (err) {
    console.error("Purchased items API error:", err);
    return NextResponse.json({ error: "Failed to load purchased items" }, { status: 500 });
  }
}
