import { getSupabaseServer } from "@/lib/supabase/server";
import { getCurrentMonthKey } from "@/lib/ai-usage";
import { getAfCFTAReportLimit } from "@/lib/plan-limits";
import {
  getEffectiveTierForUser,
} from "@/lib/team";
import {
  getUnusedPayAsYouGoCount,
  consumePayAsYouGoPurchase,
  type PayAsYouGoItemType,
} from "@/lib/pay-as-you-go";

const ITEM_TYPE: PayAsYouGoItemType = "afcfta_report";

export type AfCFTAReportUsageResult = {
  tier: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  payAsYouGoCount: number;
  canDownload: boolean;
};

/** Get current month usage for tier-based limit. */
export async function getAfCFTAReportUsageForMonth(
  userId: string,
  month?: string
): Promise<number> {
  const supabase = getSupabaseServer();
  const monthKey = month ?? getCurrentMonthKey();
  const { data, error } = await (supabase.from("afcfta_report_usage") as any)
    .select("report_count")
    .eq("user_id", userId)
    .eq("month", monthKey)
    .maybeSingle();

  if (error || !data) return 0;
  return Math.max(0, Number((data as { report_count?: number }).report_count) ?? 0);
}

/** Increment tier-based report usage for the current month. */
export async function incrementAfCFTAReportUsage(userId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const month = getCurrentMonthKey();
  const now = new Date().toISOString();
  const { data: row } = await (supabase.from("afcfta_report_usage") as any)
    .select("report_count")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();

  const prev = row as { report_count?: number } | null;
  const newCount = (prev?.report_count ?? 0) + 1;

  if (!prev) {
    await (supabase.from("afcfta_report_usage") as any).insert({
      user_id: userId,
      month,
      report_count: newCount,
      updated_at: now,
    });
  } else {
    await (supabase.from("afcfta_report_usage") as any)
      .update({ report_count: newCount, updated_at: now })
      .eq("user_id", userId)
      .eq("month", month);
  }
}

/** Get full usage summary: tier limit, used this month, payg count, and whether user can download. */
export async function getAfCFTAReportUsage(userId: string): Promise<AfCFTAReportUsageResult> {
  const [tier, used, payAsYouGoCount] = await Promise.all([
    getEffectiveTierForUser(userId),
    getAfCFTAReportUsageForMonth(userId),
    getUnusedPayAsYouGoCount(userId, ITEM_TYPE),
  ]);

  const limit = getAfCFTAReportLimit(tier);
  const remaining =
    limit === null ? null : Math.max(0, limit - used);
  const canDownload =
    payAsYouGoCount > 0 || (limit !== null && used < limit) || limit === null;

  return {
    tier,
    limit: limit ?? null,
    used,
    remaining,
    payAsYouGoCount,
    canDownload,
  };
}

/** Consume one report: use pay-as-you-go if available, otherwise tier quota. Returns true if consumed. */
export async function consumeAfCFTAReport(userId: string): Promise<{
  success: boolean;
  error?: "limit_reached" | "unauthorized";
  usage?: AfCFTAReportUsageResult;
}> {
  const usage = await getAfCFTAReportUsage(userId);
  if (!usage.canDownload) {
    return {
      success: false,
      error: "limit_reached",
      usage,
    };
  }

  if (usage.payAsYouGoCount > 0) {
    const consumed = await consumePayAsYouGoPurchase(userId, ITEM_TYPE);
    if (consumed) return { success: true, usage };
  }

  await incrementAfCFTAReportUsage(userId);
  const next = await getAfCFTAReportUsage(userId);
  return { success: true, usage: next };
}
