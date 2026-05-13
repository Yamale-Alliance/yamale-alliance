import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import type { User } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  getAnalyticsRangeBounds,
  isAnalyticsRangePreset,
  type AnalyticsRangePreset,
} from "@/lib/admin-analytics-ranges";
import { isPaidTier, readSubscriptionState } from "@/lib/subscription-state";

/** Document PDF unlock list price (matches `app/api/payments/payg/document/route.ts`). */
const DOCUMENT_UNLOCK_USD_CENTS = 300;
/** Lawyer search unlock list price (matches `app/api/payments/lawyer-search-unlock/route.ts`). */
const LAWYER_SEARCH_UNLOCK_USD_CENTS = 500;

type PlanPrices = {
  monthlyUsdCents: number;
  annualUsdCents: number;
};

async function fetchAllClerkUsers(): Promise<User[]> {
  const clerk = await clerkClient();
  const out: User[] = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const page = await clerk.users.getUserList({ limit, offset });
    out.push(...page.data);
    if (page.data.length < limit) break;
    offset += limit;
  }
  return out;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const raw = request.nextUrl.searchParams.get("range") || "last_90_days";
  const preset: AnalyticsRangePreset = isAnalyticsRangePreset(raw) ? raw : "last_90_days";
  const { fromIso, toIso } = getAnalyticsRangeBounds(preset);

  try {
    const supabase = getSupabaseServer();

    const { data: planRows, error: planErr } = await supabase
      .from("pricing_plans")
      .select("slug, price_monthly, price_annual_total")
      .in("slug", ["basic", "pro", "team"]);

    if (planErr) {
      console.error("admin analytics pricing_plans:", planErr);
    }

    const priceBySlug = new Map<string, PlanPrices>();
    for (const row of (planRows ?? []) as Array<{
      slug: string;
      price_monthly: number | null;
      price_annual_total: number | null;
    }>) {
      const monthly = Math.max(0, Math.round(Number(row.price_monthly ?? 0) * 100));
      const annual = Math.max(0, Math.round(Number(row.price_annual_total ?? 0) * 100));
      priceBySlug.set(row.slug, { monthlyUsdCents: monthly, annualUsdCents: annual });
    }

    const { data: docQtyRows, error: docErr } = await (supabase.from("pay_as_you_go_purchases") as any)
      .select("quantity")
      .eq("item_type", "document")
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    if (docErr) console.error("admin analytics document rows:", docErr);

    const documentUnits = ((docQtyRows ?? []) as Array<{ quantity: number | null }>).reduce(
      (s, r) => s + Math.max(1, Number(r.quantity ?? 1) || 1),
      0
    );
    const documentCount = (docQtyRows ?? []).length;
    const documentRevenueUsdCents = documentUnits * DOCUMENT_UNLOCK_USD_CENTS;

    const { data: searchQtyRows, error: searchErr } = await (supabase.from("pay_as_you_go_purchases") as any)
      .select("quantity")
      .eq("item_type", "lawyer_search")
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    if (searchErr) console.error("admin analytics lawyer_search rows:", searchErr);

    const searchUnits = ((searchQtyRows ?? []) as Array<{ quantity: number | null }>).reduce(
      (s, r) => s + Math.max(1, Number(r.quantity ?? 1) || 1),
      0
    );
    const lawyerSearchCount = (searchQtyRows ?? []).length;
    const lawyerSearchRevenueUsdCents = searchUnits * LAWYER_SEARCH_UNLOCK_USD_CENTS;

    const { data: mpRows, error: mpErr } = await (supabase.from("marketplace_purchases") as any)
      .select("id, marketplace_items(price_cents)")
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    if (mpErr) console.error("admin analytics marketplace_purchases:", mpErr);

    let vaultCount = 0;
    let vaultRevenueUsdCents = 0;
    for (const row of (mpRows ?? []) as Array<{
      marketplace_items?: { price_cents: number | null } | null;
    }>) {
      vaultCount += 1;
      const cents = Number(row.marketplace_items?.price_cents ?? 0);
      vaultRevenueUsdCents += Number.isFinite(cents) && cents > 0 ? Math.round(cents) : 0;
    }

    const users = await fetchAllClerkUsers();
    const fromMs = new Date(fromIso).getTime();
    const toMs = new Date(toIso).getTime();

    let activePaidSubscribers = 0;
    let estimatedMrrUsdCents = 0;
    let newSubscribersInRange = 0;
    let estimatedNewSubscriberRevenueUsdCents = 0;

    for (const user of users) {
      const meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
      const state = readSubscriptionState(meta);
      if (!state.isPaid) continue;
      activePaidSubscribers += 1;

      const tier = state.tier;
      const tierPrices = priceBySlug.get(tier);
      if (tierPrices && !state.isSubscriptionGrant) {
        const interval = state.interval === "annual" ? "annual" : "monthly";
        if (interval === "annual") {
          estimatedMrrUsdCents += Math.round(tierPrices.annualUsdCents / 12);
        } else {
          estimatedMrrUsdCents += tierPrices.monthlyUsdCents;
        }
      }

      const sinceRaw = state.subscriberSince;
      if (!sinceRaw) continue;
      const sinceMs = new Date(sinceRaw).getTime();
      if (Number.isNaN(sinceMs) || sinceMs < fromMs || sinceMs > toMs) continue;
      if (!isPaidTier(tier)) continue;
      newSubscribersInRange += 1;
      if (state.isSubscriptionGrant) continue;
      const tierPricesNew = priceBySlug.get(tier);
      if (!tierPricesNew) continue;
      const intervalNew = state.interval === "annual" ? "annual" : "monthly";
      if (intervalNew === "annual") {
        estimatedNewSubscriberRevenueUsdCents += tierPricesNew.annualUsdCents;
      } else {
        estimatedNewSubscriberRevenueUsdCents += tierPricesNew.monthlyUsdCents;
      }
    }

    const transactionRevenueUsdCents =
      documentRevenueUsdCents + lawyerSearchRevenueUsdCents + vaultRevenueUsdCents;
    const combinedPeriodRevenueUsdCents =
      estimatedNewSubscriberRevenueUsdCents + transactionRevenueUsdCents;

    return NextResponse.json({
      preset,
      from: fromIso,
      to: toIso,
      subscriptions: {
        activePaidSubscribers,
        estimatedMrrUsdCents,
        newSubscribersInRange,
        estimatedNewSubscriberRevenueUsdCents,
      },
      lawyerSearches: {
        count: lawyerSearchCount,
        revenueUsdCents: lawyerSearchRevenueUsdCents,
      },
      documentUnlocks: {
        count: documentCount,
        revenueUsdCents: documentRevenueUsdCents,
        units: documentUnits,
      },
      vaultPurchases: {
        count: vaultCount,
        revenueUsdCents: vaultRevenueUsdCents,
      },
      totals: {
        transactionRevenueUsdCents,
        /** New paid subscribers (est. first payment) in range + document + lawyer search + Vault in range. */
        combinedPeriodRevenueUsdCents,
        clerkUsersScanned: users.length,
      },
      disclaimer:
        "Subscription MRR and new-subscriber revenue are list-price estimates from Admin → Pricing and Clerk metadata (not card-settled totals). Document, lawyer search, and Vault amounts use fixed list prices or item prices × purchase rows in Supabase.",
    });
  } catch (err) {
    console.error("admin analytics GET:", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
