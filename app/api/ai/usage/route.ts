import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getAiUsage } from "@/lib/ai-usage";
import { getAiQueryLimit } from "@/lib/plan-limits";

/** GET: current user's AI query usage this month and plan limit. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { getEffectiveTierForUser } = await import("@/lib/team");
  const tier = await getEffectiveTierForUser(userId);
  const limit = getAiQueryLimit(tier);
  const usage = await getAiUsage(userId);
  const used = usage.query_count;
  const remaining = limit === null ? null : Math.max(0, limit - used);

  return NextResponse.json({
    used,
    limit,
    remaining,
    tier,
  });
}
