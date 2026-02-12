import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: fetch reviews for a marketplace item */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("marketplace_reviews")
      .select("id, user_id, rating, review_text, is_verified, created_at, updated_at")
      .eq("marketplace_item_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Marketplace reviews GET error:", error);
      return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
    }

    // Calculate average rating
    const reviews = (data ?? []) as Array<{ rating: number }>;
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    return NextResponse.json({
      reviews: data ?? [],
      averageRating: avgRating,
      totalReviews: reviews.length,
    });
  } catch (err) {
    console.error("Marketplace reviews GET error:", err);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

/** POST: create or update a review */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rating = body.rating as number | undefined;
    const reviewText = body.review_text as string | undefined;

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "rating must be between 1 and 5" }, { status: 400 });
    }

    // Check if user has purchased this item (for verified review)
    const supabase = getSupabaseServer();
    const { data: purchaseData } = await supabase
      .from("marketplace_purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("marketplace_item_id", id)
      .maybeSingle();

    const isVerified = Boolean(purchaseData);

    const { data, error } = await (supabase.from("marketplace_reviews") as any).upsert(
      {
        marketplace_item_id: id,
        user_id: userId,
        rating,
        review_text: reviewText || null,
        is_verified: isVerified,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "marketplace_item_id,user_id" }
    );

    if (error) {
      console.error("Marketplace reviews POST error:", error);
      return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, review: data });
  } catch (err) {
    console.error("Marketplace reviews POST error:", err);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }
}
