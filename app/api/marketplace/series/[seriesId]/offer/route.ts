import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchMarketplaceSeriesOffer } from "@/lib/marketplace-series-offers";
import { isValidVaultSubcategory } from "@/lib/marketplace-vault-categories";

type RouteParams = { params: Promise<{ seriesId: string }> };

/** GET: Series pricing with proration for items the user already owns. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { seriesId } = await params;
  if (!isValidVaultSubcategory(seriesId)) {
    return NextResponse.json({ error: "Unknown series" }, { status: 404 });
  }

  const { userId } = await auth();
  const supabase = getSupabaseServer();
  const offer = await fetchMarketplaceSeriesOffer(supabase, seriesId, userId);
  if (!offer) {
    return NextResponse.json({ error: "Series not found or has no paid items" }, { status: 404 });
  }

  return NextResponse.json({ offer });
}
