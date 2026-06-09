import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import {
  getDepositStatus,
  isDepositCompleted,
  pollPawaPayDepositUntilComplete,
} from "@/lib/pawapay";
import { recordUnlock, recordSearchUnlockGrant } from "@/lib/unlocks";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  getCompletedLomiCheckoutMetadata,
  normalizeLomiCheckoutSessionIdFromClient,
} from "@/lib/lomi-checkout";
import { fulfillPaymentFromMetadata } from "@/lib/payment-webhook-fulfillment";

/**
 * After pawaPay redirect: confirm payment from session_id and record unlock or day pass.
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
    const sessionId = normalizeLomiCheckoutSessionIdFromClient(
      typeof body.session_id === "string" ? body.session_id : null
    );
    if (!sessionId) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const lomiMd = await getCompletedLomiCheckoutMetadata(sessionId);
    if (lomiMd) {
      if (lomiMd.clerk_user_id !== userId) {
        return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
      }
      const kind = lomiMd.kind;
      if (kind === "payg_lawyer_search" || kind === "lawyer_search_unlock") {
        const country = (lomiMd.country ?? body.country ?? "all") as string;
        const expertise = (lomiMd.expertise ?? body.expertise ?? "") as string;
        if (expertise && expertise !== "all") {
          await recordSearchUnlockGrant(userId, country, expertise, sessionId);
        }
        return NextResponse.json({
          ok: true,
          kind: "lawyer_search_unlock",
          country,
          expertise,
          provider: "lomi",
        });
      }
      if (kind === "day-pass" || lomiMd.plan_id === "day-pass") {
        await fulfillPaymentFromMetadata(lomiMd, sessionId);
        const user = await clerkClient().then((c) => c.users.getUser(userId));
        const raw = (user.publicMetadata as Record<string, unknown>)?.day_pass_expires_at;
        const expiresAt = typeof raw === "string" ? raw : undefined;
        return NextResponse.json({ ok: true, kind: "day_pass", expiresAt, provider: "lomi" });
      }
      return NextResponse.json({ error: "Unknown Lomi session type" }, { status: 400 });
    }

    let deposit = await getDepositStatus(sessionId);
    if (!deposit || !isDepositCompleted(deposit.status)) {
      const polled = await pollPawaPayDepositUntilComplete(sessionId, {
        maxAttempts: 16,
        delayMs: 500,
      });
      if (!polled.ok) {
        const status = polled.reason === "pending" ? 503 : 400;
        return NextResponse.json(
          { error: polled.message, pending: polled.reason === "pending" },
          { status }
        );
      }
      deposit = polled.deposit;
    }

    const clerkUserId = deposit.metadata?.clerk_user_id;
    if (clerkUserId !== userId) {
      return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
    }

    const kind = deposit.metadata?.kind;
    const planId = deposit.metadata?.plan_id;

    if (kind === "lawyer_unlock") {
      const lawyerId = deposit.metadata?.lawyer_id;
      if (!lawyerId) {
        return NextResponse.json({ error: "Invalid session" }, { status: 400 });
      }
      await recordUnlock(userId, lawyerId, sessionId);
      return NextResponse.json({ ok: true, kind: "lawyer_unlock", lawyerId });
    }

    if (kind === "lawyer_search_unlock" || kind === "payg_lawyer_search") {
      const supabase = getSupabaseServer();
      const { data: row } = await (supabase.from("lawyer_search_purchases") as any)
        .select("country, expertise")
        .eq("stripe_session_id", sessionId)
        .single();
      const country = (row?.country ?? body.country ?? "all") as string;
      const expertise = (row?.expertise ?? body.expertise ?? "") as string;
      if (expertise && expertise !== "all") {
        await recordSearchUnlockGrant(userId, country, expertise, sessionId);
      }
      return NextResponse.json({ ok: true, kind: "lawyer_search_unlock", country, expertise });
    }

    if (kind === "day-pass" || planId === "day-pass") {
      const md = deposit.metadata ?? {};
      await fulfillPaymentFromMetadata(md, sessionId);
      const user = await clerkClient().then((c) => c.users.getUser(userId));
      const raw = (user.publicMetadata as Record<string, unknown>)?.day_pass_expires_at;
      const expiresAt = typeof raw === "string" ? raw : undefined;
      return NextResponse.json({ ok: true, kind: "day_pass", expiresAt });
    }

    return NextResponse.json({ error: "Unknown payment type" }, { status: 400 });
  } catch (err) {
    console.error("Confirm payment error:", err);
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
