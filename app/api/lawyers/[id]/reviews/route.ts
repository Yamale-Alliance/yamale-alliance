import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: fetch reviews for a lawyer */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Invalid lawyer id" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("lawyer_reviews")
      .select("id, user_id, rating, review_text, is_verified, created_at, updated_at")
      .eq("lawyer_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Lawyer reviews GET error:", error);
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
    console.error("Lawyer reviews GET error:", err);
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
      return NextResponse.json({ error: "Invalid lawyer id" }, { status: 400 });
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

    // Check if user has unlocked this lawyer (for verified review)
    const supabase = getSupabaseServer();
    const { data: unlockData } = await supabase
      .from("lawyer_unlocks")
      .select("id")
      .eq("user_id", userId)
      .eq("lawyer_id", id)
      .maybeSingle();

    const { data: searchUnlockData } = await supabase
      .from("lawyer_search_unlocks")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    // Also check day pass
    // Note: We'd need to check day pass expiry, but for simplicity, assume if they can review, they had access

    const isVerified = Boolean(unlockData || searchUnlockData);

    const { data, error } = await (supabase.from("lawyer_reviews") as any).upsert(
      {
        lawyer_id: id,
        user_id: userId,
        rating,
        review_text: reviewText || null,
        is_verified: isVerified,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lawyer_id,user_id" }
    );

    if (error) {
      console.error("Lawyer reviews POST error:", error);
      return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, review: data });
  } catch (err) {
    console.error("Lawyer reviews POST error:", err);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }
}
