import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Subscription amounts in USD cents from `pricing_plans` (admin-edited).
 * `price_monthly` / `price_annual_total` are whole dollars in the DB (same as `/api/pricing`).
 */
export async function getSubscriptionPlanUsdCents(
  supabase: SupabaseClient<Database>,
  planSlug: string,
  interval: "monthly" | "annual"
): Promise<number | null> {
  const { data, error } = await supabase
    .from("pricing_plans")
    .select("price_monthly, price_annual_total")
    .eq("slug", planSlug)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as { price_monthly: number | null; price_annual_total: number | null };

  if (interval === "annual") {
    const total = row.price_annual_total;
    if (total == null || Number(total) <= 0) return null;
    return Math.round(Number(total) * 100);
  }

  const monthly = row.price_monthly;
  if (monthly == null || Number(monthly) <= 0) return null;
  return Math.round(Number(monthly) * 100);
}
