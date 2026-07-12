import { normalizePlanTier, type PlanTier } from "@/lib/plan-limits";

export type AiUsageSnapshot = {
  tier?: string;
  canQuery?: boolean;
  payAsYouGoCount?: number;
};

function isPaidPlanTier(tier: PlanTier): boolean {
  return tier === "basic" || tier === "pro" || tier === "team";
}

/** Whether the user can open AI Research (paid plan, remaining quota, or PAYG credits). */
export function hasAiResearchLaunchAccess(usage: AiUsageSnapshot): boolean {
  const tier = normalizePlanTier(usage.tier);
  if (isPaidPlanTier(tier)) return true;
  if ((usage.payAsYouGoCount ?? 0) > 0) return true;
  return Boolean(usage.canQuery);
}
