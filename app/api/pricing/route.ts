export const runtime = 'edge';
export const revalidate = 600;

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  PRICING_LAWYERS_NETWORK_FEATURE,
  normalizePricingFeatures,
} from "@/lib/pricing-coming-soon-features";

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
      PRICING_LAWYERS_NETWORK_FEATURE,
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
      "<strong>Basic level AI queries/month</strong> (limited)",
      PRICING_LAWYERS_NETWORK_FEATURE,
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
      "<strong>Pro level AI queries/month</strong> (limited)",
      PRICING_LAWYERS_NETWORK_FEATURE,
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
      "<strong>Team level AI queries per user/month</strong> (limited)",
      PRICING_LAWYERS_NETWORK_FEATURE,
      "Browse marketplace",
      "Download AI conversation",
      "<strong>Additional user: $6/month each</strong>",
    ],
    cta: "Choose Team",
    highlighted: false,
  },
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const SUPABASE_TIMEOUT_MS = 3000;
const PRICING_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

const FALLBACK_SLUG_ORDER = ["free", "basic", "pro", "team"] as const;
const FALLBACK_MONTHLY_USD: Record<(typeof FALLBACK_SLUG_ORDER)[number], number> = {
  free: 0,
  basic: 5,
  pro: 15,
  team: 40,
};

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

let cachedTiers: PricingTier[] | null = null;
let cacheExpiresAt = 0;

function mapRowsToTiers(data: Row[]): PricingTier[] {
  return data.map((row) => {
    const fallback = PRICING_FALLBACKS[row.slug];
    const base: PricingTier = {
      id: row.slug,
      name: row.name?.trim() ? row.name : (fallback?.name ?? "Plan"),
      priceMonthly: row.price_monthly ?? 0,
      priceAnnualPerMonth: row.price_annual_per_month ?? 0,
      priceAnnualTotal: row.price_annual_total ?? 0,
      description: row.description?.trim() ? row.description : (fallback?.description ?? ""),
      subtitle: row.subtitle?.trim() ? row.subtitle : (fallback?.subtitle ?? undefined),
      features: normalizePricingFeatures(
        Array.isArray(row.features) && (row.features as string[]).length > 0
          ? (row.features as string[])
          : (fallback?.features ?? [])
      ),
      cta: row.cta?.trim() ? row.cta : (fallback?.cta ?? "Get Started"),
      highlighted: row.highlighted ?? false,
    };
    return base;
  });
}

function buildFallbackTiers(): PricingTier[] {
  const rows: Row[] = FALLBACK_SLUG_ORDER.map((slug) => ({
    slug,
    name: PRICING_FALLBACKS[slug]?.name ?? "",
    price_monthly: FALLBACK_MONTHLY_USD[slug],
    price_annual_per_month: 0,
    price_annual_total: 0,
    description: null,
    subtitle: null,
    features: null,
    cta: null,
    highlighted: null,
  }));
  return mapRowsToTiers(rows);
}

function getMemoryCachedTiers(): PricingTier[] | null {
  if (cachedTiers && Date.now() < cacheExpiresAt) {
    return cachedTiers;
  }
  return null;
}

function setMemoryCachedTiers(tiers: PricingTier[]): void {
  cachedTiers = tiers;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

function pricingJson(tiers: PricingTier[]) {
  return NextResponse.json(tiers, { headers: PRICING_CACHE_HEADERS });
}

async function fetchTiersFromSupabase(): Promise<PricingTier[]> {
  const supabase = getSupabaseServer();

  const fetchPromise = (async () => {
    const { data, error } = await supabase
      .from("pricing_plans")
      .select(
        "id, slug, name, price_monthly, price_annual_per_month, price_annual_total, description, subtitle, features, cta, highlighted, sort_order"
      )
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return mapRowsToTiers((data ?? []) as Row[]);
  })();

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Pricing fetch timeout")), SUPABASE_TIMEOUT_MS);
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}

export async function GET() {
  const memoryHit = getMemoryCachedTiers();
  if (memoryHit) {
    return pricingJson(memoryHit);
  }

  try {
    const tiers = await fetchTiersFromSupabase();
    setMemoryCachedTiers(tiers);
    return pricingJson(tiers);
  } catch (err) {
    console.error("Pricing API error (serving fallbacks):", err);
    const tiers = buildFallbackTiers();
    setMemoryCachedTiers(tiers);
    return pricingJson(tiers);
  }
}
