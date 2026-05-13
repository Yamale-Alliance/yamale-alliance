import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCurrentMonthKey } from "@/lib/ai-usage";
import { estimateAiApiUsdCentsFromTokens } from "@/lib/ai-token-cost-estimate";

/** GET: list AI usage per user (current month and previous month). Admin only. */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const supabase = getSupabaseServer();
  const thisMonth = getCurrentMonthKey();
  const prev = new Date();
  prev.setMonth(prev.getMonth() - 1);
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("ai_usage")
    .select("user_id, month, query_count, input_tokens, output_tokens, updated_at")
    .in("month", [thisMonth, prevMonth])
    .order("month", { ascending: false })
    .order("query_count", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    user_id: string;
    month: string;
    query_count: number;
    input_tokens: number;
    output_tokens: number;
    updated_at: string;
  }>;

  // Aggregate by user for current month (and optionally include previous)
  const byUser = new Map<
    string,
    { user_id: string; month: string; query_count: number; input_tokens: number; output_tokens: number; updated_at: string }[]
  >();
  for (const r of rows) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  const summary = Array.from(byUser.entries()).map(([user_id, entries]) => {
    const current = entries.find((e) => e.month === thisMonth);
    const previous = entries.find((e) => e.month === prevMonth);
    const input_tokens = current?.input_tokens ?? 0;
    const output_tokens = current?.output_tokens ?? 0;
    return {
      user_id,
      current_month: thisMonth,
      query_count: current?.query_count ?? 0,
      input_tokens,
      output_tokens,
      total_tokens: input_tokens + output_tokens,
      previous_month_query_count: previous?.query_count ?? 0,
      estimated_usage_usd_cents: estimateAiApiUsdCentsFromTokens(input_tokens, output_tokens),
    };
  });

  // Sort by current month query count descending
  summary.sort((a, b) => b.query_count - a.query_count);

  const total_estimated_usage_usd_cents = summary.reduce((s, u) => s + u.estimated_usage_usd_cents, 0);

  return NextResponse.json({
    month: thisMonth,
    prev_month: prevMonth,
    usage: summary,
    total_queries: summary.reduce((s, u) => s + u.query_count, 0),
    total_input_tokens: summary.reduce((s, u) => s + u.input_tokens, 0),
    total_output_tokens: summary.reduce((s, u) => s + u.output_tokens, 0),
    total_estimated_usage_usd_cents,
  });
}
