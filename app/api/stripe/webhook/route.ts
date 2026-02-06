import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { clerkClient } from "@clerk/nextjs/server";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret) {
  console.warn("STRIPE_WEBHOOK_SECRET not set – webhooks will not be verified");
}

export async function POST(request: NextRequest) {
  let event: Stripe.Event;
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkUserId =
          session.client_reference_id ??
          (session.metadata?.clerk_user_id as string | undefined);
        const planId = session.metadata?.plan_id as string | undefined;

        if (clerkUserId && planId) {
          const clerk = await clerkClient();
          const user = await clerk.users.getUser(clerkUserId);
          const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;

          if (planId === "day-pass") {
            const now = new Date();
            const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            await clerk.users.updateUserMetadata(clerkUserId, {
              publicMetadata: {
                ...existing,
                day_pass_expires_at: expires.toISOString(),
                day_pass_last_purchase_at: now.toISOString(),
              },
            });
          } else {
            const tier = planId === "team" ? "plus" : planId;
            await clerk.users.updateUserMetadata(clerkUserId, {
              publicMetadata: { ...existing, tier },
            });
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const clerkUserId = sub.metadata?.clerk_user_id as string | undefined;
        if (event.type === "customer.subscription.deleted" && clerkUserId) {
          const clerk = await clerkClient();
          const user = await clerk.users.getUser(clerkUserId);
          const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
          await clerk.users.updateUserMetadata(clerkUserId, {
            publicMetadata: { ...existing, tier: "free" },
          });
        }
        break;
      }

      default:
        // Unhandled event type
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
