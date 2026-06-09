import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { resolveMarketplaceItemFileForAccess } from "@/lib/marketplace-item-files";
import { getSupabaseServer } from "@/lib/supabase/server";

const BUCKET = "marketplace-files";
const SIGNED_URL_EXPIRY_SEC = 3600; // 1 hour

/** GET: return signed URL for item file (preview or download).
 * - Free items (price_cents <= 0): anyone can access without purchase.
 * - Paid items: require sign-in + purchase record.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const language = request.nextUrl.searchParams.get("lang");

  const supabase = getSupabaseServer();
  const { data, error: itemErr } = await supabase
    .from("marketplace_items")
    .select("id, file_path, file_name, file_format, published, price_cents")
    .eq("id", id)
    .single();

  if (itemErr || !data) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  const item = data as {
    id: string;
    file_path: string | null;
    file_name: string | null;
    file_format: string | null;
    published: boolean;
    price_cents: number | null;
  };
  if (!item.published) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const resolved = await resolveMarketplaceItemFileForAccess(supabase, id, language, {
    file_path: item.file_path,
    file_name: item.file_name,
    file_format: item.file_format,
  });
  if (!resolved?.file_path?.trim()) {
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
    .createSignedUrl(resolved.file_path, SIGNED_URL_EXPIRY_SEC);

  if (signErr) {
    console.error("Marketplace download signed URL error:", signErr);
    return NextResponse.json({ error: "Failed to generate download link" }, { status: 500 });
  }
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "Failed to generate download link" }, { status: 500 });
  }

  return NextResponse.json({
    url: signed.signedUrl,
    file_name: resolved.file_name,
    file_format: resolved.file_format,
    language_code: resolved.language_code,
    expires_in: SIGNED_URL_EXPIRY_SEC,
  });
}
