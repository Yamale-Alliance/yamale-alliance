import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

const BUCKET = "marketplace-files";
const SIGNED_URL_EXPIRY_SEC = 3600; // 1 hour

/** GET: return signed URL for item file (viewing only, no download).
 * - Free items (price_cents <= 0): anyone can access without purchase.
 * - Paid items: require sign-in + purchase record.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data, error: itemErr } = await supabase
    .from("marketplace_items")
    .select("id, file_path, file_name, published, price_cents")
    .eq("id", id)
    .single();

  if (itemErr || !data) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  const item = data as {
    id: string;
    file_path: string | null;
    file_name: string | null;
    published: boolean;
    price_cents: number | null;
  };
  if (!item.published) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  if (!item.file_path?.trim()) {
    return NextResponse.json({ error: "No file available for this item" }, { status: 404 });
  }

  const isFree = !item.price_cents || item.price_cents <= 0;

  // Paid items require auth + purchase; free items do not.
  if (!isFree) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to access" }, { status: 401 });
    }

    const { data: purchase } = await supabase
      .from("marketplace_purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("marketplace_item_id", id)
      .maybeSingle();

    if (!purchase) {
      return NextResponse.json({ error: "Purchase this item to view" }, { status: 403 });
    }
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(item.file_path, SIGNED_URL_EXPIRY_SEC);

  if (signErr) {
    console.error("Marketplace download signed URL error:", signErr);
    return NextResponse.json({ error: "Failed to generate download link" }, { status: 500 });
  }
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "Failed to generate download link" }, { status: 500 });
  }

  return NextResponse.json({
    url: signed.signedUrl,
    file_name: item.file_name,
    expires_in: SIGNED_URL_EXPIRY_SEC,
  });
}
