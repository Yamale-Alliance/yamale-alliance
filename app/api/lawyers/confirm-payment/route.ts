import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { recordUnlock, recordSearchUnlockGrant } from "@/lib/unlocks";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * After Stripe redirect: confirm payment from session_id and record unlock or day pass.
 * Call this when the user lands on /lawyers with session_id so the unlock is applied
 * even if the webhook hasn't run yet.
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
    const planId = session.metadata?.plan_id as string | undefined;

    if (kind === "lawyer_unlock") {
      const lawyerId = session.metadata?.lawyer_id as string | undefined;
      if (!lawyerId) {
        return NextResponse.json({ error: "Invalid session" }, { status: 400 });
      }
      await recordUnlock(userId, lawyerId, session.id);
      return NextResponse.json({ ok: true, kind: "lawyer_unlock", lawyerId });
    }

    if (kind === "lawyer_search_unlock") {
      const supabase = getSupabaseServer();
      const { data: row } = await (supabase.from("lawyer_search_purchases") as any)
        .select("country, expertise, lawyer_ids")
        .eq("stripe_session_id", sessionId)
        .single();
      const lawyerIdsRaw = row?.lawyer_ids;
      const lawyerIds = Array.isArray(lawyerIdsRaw)
        ? (lawyerIdsRaw as string[]).filter((id: unknown) => typeof id === "string")
        : [];
      if (lawyerIds.length > 0) {
        await recordSearchUnlockGrant(userId, lawyerIds, session.id);
      }
      const country = (row?.country ?? body.country ?? "all") as string;
      const expertise = (row?.expertise ?? body.expertise ?? "") as string;
      return NextResponse.json({ ok: true, kind: "lawyer_search_unlock", country, expertise });
    }

    if (kind === "day-pass" || planId === "day-pass") {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
      const now = new Date();
      const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...existing,
          day_pass_expires_at: expires.toISOString(),
          day_pass_last_purchase_at: now.toISOString(),
        },
      });
      return NextResponse.json({ ok: true, kind: "day_pass", expiresAt: expires.toISOString() });
    }

    return NextResponse.json({ error: "Unknown payment type" }, { status: 400 });
  } catch (err) {
    console.error("Confirm payment error:", err);
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
