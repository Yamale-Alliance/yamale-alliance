import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import type { Database } from "@/lib/database.types";

type MarketplaceItemRow = Database["public"]["Tables"]["marketplace_items"]["Row"];

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
    const { data, error } = await supabase
      .from("marketplace_items")
      .select(
        "id, type, title, author, description, price_cents, currency, image_url, published, sort_order, file_path, file_name, file_format, video_url, landing_page_html, created_at"
      )
      .eq("id", id)
      .single();

    const row = data as (MarketplaceItemRow & { file_path?: string | null; video_url?: string | null }) | null;
    if (error || !row) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (!row.published) {
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

    const has_file = !!row.file_path;
    const { file_path: _fp, ...rest } = row;
    const item = { ...rest, purchased, has_file };
    return NextResponse.json({ item });
  } catch (err) {
    console.error("Marketplace item API error:", err);
    return NextResponse.json({ error: "Failed to load item" }, { status: 500 });
  }
}
