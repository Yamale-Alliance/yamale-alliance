import { getSupabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type AiUsageRow = Database["public"]["Tables"]["ai_usage"]["Row"];

import { getAiQueryLimit } from "@/lib/plan-limits";

/** @deprecated Use getAiQueryLimit from @/lib/plan-limits */
export const AI_QUERY_LIMITS = {
  free: 0,
  basic: 10,
  pro: 50,
  team: null,
} as Record<string, number | null>;

export function getAiQueryLimitForTier(tier: string): number | null {
  return getAiQueryLimit(tier);
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function getAiUsage(
  userId: string,
  month?: string
): Promise<{ query_count: number; input_tokens: number; output_tokens: number }> {
  const supabase = getSupabaseServer();
  const monthKey = month ?? getCurrentMonthKey();
  const { data, error } = await supabase
    .from("ai_usage")
    .select("query_count, input_tokens, output_tokens")
    .eq("user_id", userId)
    .eq("month", monthKey)
    .maybeSingle();
  const row = data as AiUsageRow | null;
  if (error || !row) {
    return { query_count: 0, input_tokens: 0, output_tokens: 0 };
  }
  return {
    query_count: row.query_count ?? 0,
    input_tokens: Number(row.input_tokens) ?? 0,
    output_tokens: Number(row.output_tokens) ?? 0,
  };
}

/** Record one AI query and add token counts for the current month (atomic in Postgres). */
export async function incrementAiUsage(
  userId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const supabase = getSupabaseServer();
  const month = getCurrentMonthKey();
  const { error } = await (supabase as any).rpc("increment_ai_usage_atomic", {
    p_user_id: userId,
    p_month: month,
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
  });
  if (!error) return;

  const missingRpc =
    error.code === "42883" ||
    error.code === "PGRST202" ||
    String(error.message || "").includes("increment_ai_usage_atomic");
  if (missingRpc) {
    await incrementAiUsageLegacy(supabase, userId, month, inputTokens, outputTokens);
    return;
  }
  console.error("incrementAiUsage rpc:", error.message);
}

/** Used only when `increment_ai_usage_atomic` migration is not applied yet. */
async function incrementAiUsageLegacy(
  supabase: ReturnType<typeof getSupabaseServer>,
  userId: string,
  month: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const now = new Date().toISOString();
  const { data: row } = await supabase
    .from("ai_usage")
    .select("query_count, input_tokens, output_tokens")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();

  const prev = (row as { query_count?: number; input_tokens?: number; output_tokens?: number } | null) ?? null;
  if (!prev) {
    await (supabase.from("ai_usage") as any).insert({
      user_id: userId,
      month,
      query_count: 1,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      updated_at: now,
    });
    return;
  }
  await (supabase.from("ai_usage") as any)
    .update({
      query_count: (prev.query_count ?? 0) + 1,
      input_tokens: (prev.input_tokens ?? 0) + inputTokens,
      output_tokens: (prev.output_tokens ?? 0) + outputTokens,
      updated_at: now,
    })
    .eq("user_id", userId)
    .eq("month", month);
}
