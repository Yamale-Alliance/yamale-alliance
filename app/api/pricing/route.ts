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

// Fallbacks when the database has no custom copy (so admin-edited values always show on the public page).
const PRICING_FALLBACKS: Record<string, Partial<PricingTier>> = {
  free: {
    description: "Explore African law",
    features: [
      "Unlimited browsing of full texts of laws",
      "Save up to 10 documents for easy access",
      "Browse lawyer directory",
      "Browse marketplace",
    ],
    cta: "Get Started Free",
    highlighted: false,
  },
  basic: {
    name: "Basic",
    description: "",
    subtitle: "or $50/year (save $10)",
    features: [
      "Unlimited browsing of full texts of laws",
      "<strong>5 document downloads/month</strong>",
      "<strong>Basic level AI queries/month</strong> (limited)",
      "<strong>1 AfCFTA report/month</strong> (view &amp; download)",
      "Browse lawyer directory",
      "Browse marketplace",
    ],
    cta: "Choose Basic",
    highlighted: false,
  },
  pro: {
    name: "Pro",
    description: "",
    subtitle: "or $150/year (save $30)",
    features: [
      "Unlimited browsing of full texts of laws",
      "<strong>20 document downloads/month</strong>",
      "<strong>Pro level AI queries/month</strong> (limited)",
      "<strong>5 AfCFTA reports/month</strong> (view &amp; download)",
      "Browse lawyer directory",
      "Browse marketplace",
      "Download AI conversation",
    ],
    cta: "Choose Pro",
    highlighted: true,
  },
  team: {
    name: "Team",
    description: "",
    subtitle: "or $400/year (save $80)",
    features: [
      "<strong>5 users included</strong>",
      "<strong>25 document downloads per user/month</strong>",
      "<strong>Team level AI queries per user/month</strong> (limited)",
      "<strong>2 AfCFTA reports per user/month</strong> (view &amp; download)",
      "Browse lawyer directory",
      "Browse marketplace",
      "Download AI conversation",
      "<strong>Additional user: $6/month each</strong>",
    ],
    cta: "Choose Team",
    highlighted: false,
  },
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
    const tiers: PricingTier[] = ((data ?? []) as Row[]).map((row) => {
      const fallback = PRICING_FALLBACKS[row.slug];
      const base: PricingTier = {
        id: row.slug,
        name: (row.name?.trim()) ? row.name : (fallback?.name ?? "Plan"),
        priceMonthly: row.price_monthly ?? 0,
        priceAnnualPerMonth: row.price_annual_per_month ?? 0,
        priceAnnualTotal: row.price_annual_total ?? 0,
        description: (row.description?.trim()) ? row.description : (fallback?.description ?? ""),
        subtitle: (row.subtitle?.trim()) ? row.subtitle : (fallback?.subtitle ?? undefined),
        features: Array.isArray(row.features) && (row.features as string[]).length > 0
          ? (row.features as string[])
          : (fallback?.features ?? []),
        cta: (row.cta?.trim()) ? row.cta : (fallback?.cta ?? "Get Started"),
        highlighted: row.highlighted ?? false,
      };
      return base;
    });

    return NextResponse.json(tiers);
  } catch (err) {
    console.error("Pricing API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch pricing" },
      { status: 500 }
    );
  }
}
