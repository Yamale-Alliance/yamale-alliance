import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * After Stripe redirect for cart checkout:
 * confirm payment from session_id and record purchases for all cart items.
 * This complements the webhook so local dev still works even without webhooks configured.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = body.session_id as string | undefined;
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const clerkUserId = (session.metadata?.clerk_user_id as string | undefined) ?? session.client_reference_id;
    if (clerkUserId !== userId) {
      return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
    }

    const kind = session.metadata?.kind as string | undefined;
    if (kind !== "marketplace_cart") {
      return NextResponse.json({ error: "Not a marketplace cart session" }, { status: 400 });
    }

    let ids: string[] = [];
    try {
      const raw = session.metadata?.item_ids as string | undefined;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          ids = parsed.filter((v) => typeof v === "string" && v.trim().length > 0);
        }
      }
    } catch {
      // ignore parse errors
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: "No items found in cart session" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const uniqueIds = Array.from(new Set(ids));
    for (const itemId of uniqueIds) {
      await (supabase.from("marketplace_purchases") as any).upsert(
        {
          user_id: userId,
          marketplace_item_id: itemId,
          stripe_session_id: session.id,
        },
        { onConflict: "user_id,marketplace_item_id" }
      );
    }

    return NextResponse.json({ ok: true, marketplace_item_ids: uniqueIds });
  } catch (err) {
    console.error("Cart confirm payment error:", err);
    return NextResponse.json({ error: "Failed to confirm cart payment" }, { status: 500 });
  }
}

