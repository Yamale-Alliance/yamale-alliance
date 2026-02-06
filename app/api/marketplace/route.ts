import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: list published marketplace items */
export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("marketplace_items")
      .select("id, type, title, author, description, price_cents, currency, image_url, sort_order")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Marketplace list error:", error);
      return NextResponse.json({ error: "Failed to load marketplace" }, { status: 500 });
    }
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    console.error("Marketplace API error:", err);
    return NextResponse.json({ error: "Failed to load marketplace" }, { status: 500 });
  }
}
