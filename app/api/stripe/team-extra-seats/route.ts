import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentPageSession } from "@/lib/pawapay";
import { isTeamAdmin } from "@/lib/team";
import { clerkClient } from "@clerk/nextjs/server";
import { EXTRA_SEAT_CENTS } from "@/lib/team";

/**
 * Create pawaPay Payment Page session for extra team seats.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = user.publicMetadata as Record<string, unknown> | undefined;
    if (!isTeamAdmin(metadata)) {
      return NextResponse.json({ error: "Team admin only" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const seats = Math.min(Math.max(1, Number(body.seats) || 1), 50);
    const amountCents = seats * EXTRA_SEAT_CENTS;

    const origin = request.headers.get("origin") || request.nextUrl.origin;

    const depositId = crypto.randomUUID();
    const returnUrl = `${origin}/ai-research/team?session_id=${encodeURIComponent(depositId)}`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents,
      currency: (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase(),
      returnUrl,
      reason: "Extra team seat",
      customerMessage: `Additional seat for your Team plan (${seats} seat${seats > 1 ? "s" : ""})`,
      country: process.env.PAWAPAY_COUNTRY,
      metadata: {
        clerk_user_id: userId,
        kind: "team_extra_seats",
        seats: String(seats),
      },
    });
    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("Team extra seats checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
