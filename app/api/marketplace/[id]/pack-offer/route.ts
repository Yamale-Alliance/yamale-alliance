import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchMarketplaceItemPackOffer } from "@/lib/marketplace-item-packs";

type RouteParams = { params: Promise<{ id: string }> };

/** GET: Item pack pricing with proration for items the user already owns. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { userId } = await auth();
  const supabase = getSupabaseServer();
  const offer = await fetchMarketplaceItemPackOffer(supabase, id.trim(), userId);
  if (!offer) {
    return NextResponse.json({ error: "No pack configured for this item" }, { status: 404 });
  }

  return NextResponse.json({ offer });
}
