import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin";
import { stripe } from "@/lib/stripe";

type SubscriptionSummary = {
  user_id: string;
  email: string | null;
  name: string;
  tier: string;
  status: string;
  cancel_at_period_end: boolean;
  started_at: string;
  current_period_end: string;
};

/** GET: list current AI subscriptions from Stripe, grouped by Clerk user. Admin only. */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    // Fetch all active/trialing subscriptions from Stripe
    const subs = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      expand: ["data.items.data.price.product"],
    });

    const summaries: SubscriptionSummary[] = [];
    const userIds = new Set<string>();

    type SubWithPeriod = { start_date?: number; current_period_end?: number; status: string; metadata?: Record<string, string>; items?: { data?: Array<{ price?: { product?: { name?: string | null } } }> }; cancel_at_period_end?: boolean };
    for (const raw of subs.data) {
      const sub = raw as unknown as SubWithPeriod;
      if (!["active", "trialing", "past_due", "unpaid"].includes(sub.status)) continue;
      const clerkUserId = (sub.metadata?.clerk_user_id as string | undefined) ?? null;
      if (!clerkUserId) continue;

      let planId = (sub.metadata?.plan_id as string | undefined) ?? null;
      if (!planId && sub.items?.data?.[0]?.price?.product) {
        const product = sub.items.data[0].price.product as { name?: string | null } | null;
        const name = ((product?.name ?? "") as string).toLowerCase();
        if (name.includes("basic")) planId = "basic";
        else if (name.includes("pro")) planId = "pro";
        else if (name.includes("team")) planId = "team";
      }
      if (!planId) planId = "unknown";

      const startedAt = sub.start_date ? new Date(sub.start_date * 1000).toISOString() : new Date().toISOString();
      const currentPeriodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : startedAt;

      summaries.push({
        user_id: clerkUserId,
        email: null,
        name: "",
        tier: planId,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        started_at: startedAt,
        current_period_end: currentPeriodEnd,
      });
      userIds.add(clerkUserId);
    }

    // Enrich with Clerk user info
    const userNameMap = new Map<string, { name: string; email: string | null }>();
    try {
      const clerk = await clerkClient();
      await Promise.all(
        Array.from(userIds).map(async (userId) => {
          try {
            const user = await clerk.users.getUser(userId);
            const name =
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              (user.username ?? "") ||
              (user.emailAddresses?.[0]?.emailAddress ?? "") ||
              userId;
            const email = user.emailAddresses?.[0]?.emailAddress ?? null;
            userNameMap.set(userId, { name, email });
          } catch {
            userNameMap.set(userId, { name: userId, email: null });
          }
        })
      );
    } catch (e) {
      console.error("Admin subscriptions: failed to load Clerk users", e);
    }

    const enriched = summaries.map((s) => {
      const u = userNameMap.get(s.user_id);
      return {
        ...s,
        name: u?.name ?? s.user_id,
        email: u?.email ?? null,
      };
    });

    // Sort by tier then user name
    enriched.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier.localeCompare(b.tier);
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ subscriptions: enriched });
  } catch (err) {
    console.error("Admin subscriptions GET error:", err);
    return NextResponse.json({ error: "Failed to load subscriptions" }, { status: 500 });
  }
}

