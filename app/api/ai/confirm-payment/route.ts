import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * After Stripe redirect: confirm pay-as-you-go AI query payment from session_id and record purchase.
 * Call this when the user lands on /ai-research with session_id so the purchase
 * is applied even if the webhook hasn't run yet.
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

    const clerkUserId = session.metadata?.clerk_user_id as string | undefined;
    if (clerkUserId !== userId) {
      return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
    }

    const kind = session.metadata?.kind as string | undefined;
    if (kind !== "payg_ai_query") {
      return NextResponse.json({ error: "Not an AI query purchase session" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    
    // Check if purchase already recorded (idempotent)
    const { data: existing, error: checkError } = await (supabase.from("pay_as_you_go_purchases") as any)
      .select("id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing purchase:", checkError);
    }

    if (!existing) {
      // Record the purchase
      const { data: inserted, error: insertError } = await (supabase.from("pay_as_you_go_purchases") as any).insert({
        user_id: userId,
        item_type: "ai_query",
        quantity: 1,
        stripe_session_id: sessionId,
      }).select().single();

      if (insertError) {
        console.error("Error inserting pay-as-you-go purchase:", insertError);
        return NextResponse.json({ error: "Failed to record purchase", details: insertError.message }, { status: 500 });
      }

      console.log("Pay-as-you-go AI query purchase recorded:", inserted);
    } else {
      console.log("Pay-as-you-go purchase already exists for session:", sessionId);
    }

    // Verify the purchase was recorded
    const { data: verify } = await (supabase.from("pay_as_you_go_purchases") as any)
      .select("id, quantity")
      .eq("user_id", userId)
      .eq("item_type", "ai_query")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    return NextResponse.json({ 
      ok: true, 
      kind: "payg_ai_query",
      recorded: !!verify,
      purchaseId: verify?.id 
    });
  } catch (err) {
    console.error("AI query confirm payment error:", err);
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
