import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";

/** After checkout redirect: set user tier from Stripe session so UI updates without waiting for webhook. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = body.session_id as string | undefined;
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Session not paid yet" },
        { status: 400 }
      );
    }

    const sessionUserId =
      session.client_reference_id ??
      (session.metadata?.clerk_user_id as string | undefined);
    if (sessionUserId !== userId) {
      return NextResponse.json({ error: "Session does not match user" }, { status: 403 });
    }

    let planId =
      (session.metadata?.plan_id as string | undefined) ?? null;

    if (!planId && session.subscription) {
      const sub =
        typeof session.subscription === "string"
          ? await stripe.subscriptions.retrieve(session.subscription, {
              expand: ["items.data.price.product"],
            })
          : (session.subscription as Stripe.Subscription);
      planId = (sub.metadata?.plan_id as string) ?? null;
      if (!planId && sub.items?.data?.[0]?.price?.product) {
        const product = sub.items.data[0].price.product as Stripe.Product;
        const name = (product.name ?? "").toLowerCase();
        if (name.includes("basic")) planId = "basic";
        else if (name.includes("pro")) planId = "pro";
        else if (name.includes("team")) planId = "team";
      }
    }

    if (!planId || !["basic", "pro", "team"].includes(planId)) {
      return NextResponse.json(
        { error: "Could not determine plan from session" },
        { status: 400 }
      );
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const nextMeta = { ...existing, tier: planId };
    if (planId === "team") {
      nextMeta.team_admin = true;
      nextMeta.team_extra_seats = (existing.team_extra_seats as number) ?? 0;
    }
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: nextMeta,
    });

    return NextResponse.json({ ok: true, tier: planId });
  } catch (err) {
    console.error("Stripe sync-tier error:", err);
    return NextResponse.json(
      { error: "Failed to sync plan" },
      { status: 500 }
    );
  }
}
