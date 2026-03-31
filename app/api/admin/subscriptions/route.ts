import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin";

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

/** GET: list current paid users from Clerk metadata. Admin only. */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const summaries: SubscriptionSummary[] = [];
    const userNameMap = new Map<string, { name: string; email: string | null }>();
    try {
      const clerk = await clerkClient();
      const users = await clerk.users.getUserList({ limit: 500 });
      for (const user of users.data) {
        const meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
        const tier = String(meta.tier || "free");
        if (!["basic", "pro", "team"].includes(tier)) continue;
        const name =
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          (user.username ?? "") ||
          (user.emailAddresses?.[0]?.emailAddress ?? "") ||
          user.id;
        const email = user.emailAddresses?.[0]?.emailAddress ?? null;
        userNameMap.set(user.id, { name, email });
        summaries.push({
          user_id: user.id,
          email,
          name,
          tier,
          status: "active",
          cancel_at_period_end: false,
          started_at: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
          current_period_end: user.updatedAt ? new Date(user.updatedAt).toISOString() : new Date().toISOString(),
        });
      }
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

