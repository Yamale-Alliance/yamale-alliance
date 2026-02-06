import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export type PricingTier = {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnualPerMonth: number;
  priceAnnualTotal: number;
  description: string;
  subtitle?: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("pricing_plans")
      .select("id, slug, name, price_monthly, price_annual_per_month, price_annual_total, description, subtitle, features, cta, highlighted, sort_order")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    type Row = {
      slug: string;
      name: string;
      price_monthly: number | null;
      price_annual_per_month: number | null;
      price_annual_total: number | null;
      description: string | null;
      subtitle: string | null;
      features: unknown;
      cta: string | null;
      highlighted: boolean | null;
    };
    const tiers: PricingTier[] = ((data ?? []) as Row[]).map((row) => ({
      id: row.slug,
      name: row.name,
      priceMonthly: row.price_monthly ?? 0,
      priceAnnualPerMonth: row.price_annual_per_month ?? 0,
      priceAnnualTotal: row.price_annual_total ?? 0,
      description: row.description ?? "",
      subtitle: row.subtitle ?? undefined,
      features: Array.isArray(row.features) ? row.features : [],
      cta: row.cta ?? "Get Started",
      highlighted: row.highlighted ?? false,
    }));

    return NextResponse.json(tiers);
  } catch (err) {
    console.error("Pricing API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch pricing" },
      { status: 500 }
    );
  }
}
