import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAiUsage } from "@/lib/ai-usage";
import { estimateAiApiUsdFromTokens } from "@/lib/ai-token-cost-estimate";
import { getAiQueryLimit } from "@/lib/plan-limits";
import { getUnusedPayAsYouGoCount } from "@/lib/pay-as-you-go";

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
  
  // Check for pay-as-you-go purchases
  const payAsYouGoCount = await getUnusedPayAsYouGoCount(userId, "ai_query");
  
  // Remaining = plan limit - used, but if they have pay-as-you-go purchases, they can still query
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const canQuery = limit === null || (remaining !== null && remaining > 0) || payAsYouGoCount > 0;

  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const estimatedUsageUsd =
    Math.round(estimateAiApiUsdFromTokens(inputTokens, outputTokens) * 100) / 100;

  return NextResponse.json({
    used,
    limit,
    remaining,
    tier,
    payAsYouGoCount,
    canQuery,
    inputTokens,
    outputTokens,
    estimatedUsageUsd,
  });
}
