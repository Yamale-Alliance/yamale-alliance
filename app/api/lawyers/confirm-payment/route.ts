import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { recordSearchUnlockGrant } from "@/lib/unlocks";
import {
  getCompletedLomiCheckoutMetadata,
  isLomiConfigured,
  normalizeLomiCheckoutSessionIdFromClient,
  pollCompletedLomiCheckoutMetadata,
} from "@/lib/lomi-checkout";
import { fulfillPaymentFromMetadata } from "@/lib/payment-webhook-fulfillment";

/** After Lomi redirect: confirm payment and record lawyer search unlock or day pass. */
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

    let lomiMd = await getCompletedLomiCheckoutMetadata(sessionId);
    if (!lomiMd && isLomiConfigured()) {
      lomiMd = await pollCompletedLomiCheckoutMetadata(sessionId);
    }
    if (!lomiMd) {
      return NextResponse.json(
        {
          error:
            "We could not confirm payment yet. If you finished checkout, wait a few seconds and refresh this page.",
          pending: true,
        },
        { status: 503 }
      );
    }

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
  } catch (err) {
    console.error("Confirm payment error:", err);
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
