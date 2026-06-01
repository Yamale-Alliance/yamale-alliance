import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Typed confirmation phrase required in the admin API body. */
export const LAUNCH_METRICS_RESET_CONFIRM_PHRASE = "RESET_LAUNCH_METRICS";

export type LaunchMetricsResetScope = "all" | "revenue" | "ai";

export type LaunchMetricsTableResult = {
  table: string;
  deleted: number | null;
  error: string | null;
};

export type LaunchMetricsResetResult = {
  scope: LaunchMetricsResetScope;
  tables: LaunchMetricsTableResult[];
  ok: boolean;
};

type DeleteStep = {
  table: string;
  /** PostgREST filter column — deletes rows where this column is not null. */
  filterColumn: string;
};

/** Order respects typical FK dependencies (children before parents). */
const REVENUE_DELETE_STEPS: DeleteStep[] = [
  { table: "refund_requests", filterColumn: "id" },
  { table: "shopping_cart_items", filterColumn: "user_id" },
  { table: "payment_webhook_events", filterColumn: "id" },
  { table: "payment_checkout_pending", filterColumn: "payment_ref" },
  { table: "marketplace_purchases", filterColumn: "id" },
  { table: "pay_as_you_go_purchases", filterColumn: "id" },
  { table: "lawyer_search_unlock_grants", filterColumn: "id" },
  { table: "lawyer_search_unlocks", filterColumn: "user_id" },
  { table: "lawyer_search_purchases", filterColumn: "user_id" },
  { table: "lawyer_unlocks", filterColumn: "id" },
  { table: "subscription_ledger", filterColumn: "id" },
  { table: "afcfta_report_usage", filterColumn: "user_id" },
];

const AI_DELETE_STEPS: DeleteStep[] = [
  { table: "ai_response_feedback", filterColumn: "id" },
  { table: "ai_bug_reports", filterColumn: "id" },
  { table: "ai_query_log", filterColumn: "id" },
  { table: "ai_usage", filterColumn: "user_id" },
  { table: "ai_usage_daily", filterColumn: "user_id" },
];

async function deleteAllRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<Database> | any,
  step: DeleteStep
): Promise<LaunchMetricsTableResult> {
  const { error, count } = await supabase
    .from(step.table)
    .delete({ count: "exact" })
    .not(step.filterColumn, "is", null);

  if (error) {
    return { table: step.table, deleted: null, error: error.message };
  }
  return { table: step.table, deleted: count ?? 0, error: null };
}

export async function resetLaunchMetrics(
  supabase: SupabaseClient<Database>,
  scope: LaunchMetricsResetScope
): Promise<LaunchMetricsResetResult> {
  const steps =
    scope === "all"
      ? [...REVENUE_DELETE_STEPS, ...AI_DELETE_STEPS]
      : scope === "revenue"
        ? REVENUE_DELETE_STEPS
        : AI_DELETE_STEPS;

  const tables: LaunchMetricsTableResult[] = [];
  for (const step of steps) {
    tables.push(await deleteAllRows(supabase, step));
  }

  return {
    scope,
    tables,
    ok: tables.every((t) => t.error == null),
  };
}

export const LAUNCH_METRICS_RESET_TABLE_LABELS: Record<string, string> = {
  refund_requests: "Refund requests",
  shopping_cart_items: "Shopping carts",
  payment_webhook_events: "Payment webhook log",
  payment_checkout_pending: "Pending checkouts",
  marketplace_purchases: "Vault purchases (removes buyer access)",
  pay_as_you_go_purchases: "Library / PAYG purchases (removes unlocks)",
  lawyer_search_unlock_grants: "Lawyer search grants",
  lawyer_search_unlocks: "Lawyer search unlocks",
  lawyer_search_purchases: "Lawyer search purchases",
  lawyer_unlocks: "Lawyer profile unlocks",
  subscription_ledger: "Subscription payment ledger",
  afcfta_report_usage: "AfCFTA report usage counters",
  ai_response_feedback: "AI response feedback",
  ai_bug_reports: "AI bug reports",
  ai_query_log: "AI query log",
  ai_usage: "AI usage (monthly)",
  ai_usage_daily: "AI usage (daily caps)",
};
