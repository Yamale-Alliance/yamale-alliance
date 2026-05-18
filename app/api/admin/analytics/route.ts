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
import { getLawPrintPriceUsdCents } from "@/lib/platform-settings";
/** Lawyer search unlock list price (matches `app/api/payments/lawyer-search-unlock/route.ts`). */
const LAWYER_SEARCH_UNLOCK_USD_CENTS = 500;
/** Matches `app/api/payments/payg/ai-query/route.ts` list price. */
const PAYG_AI_QUERY_USD_CENTS = 100;
/** Matches `app/api/payments/payg/afcfta-report/route.ts` list price. */
const PAYG_AFCFTA_REPORT_USD_CENTS = 1500;

const DETAIL_LIMIT_VAULT = 500;
const DETAIL_LIMIT_PAYG = 500;
const DETAIL_LIMIT_NEW_SUBS = 300;

function clerkUserDisplayName(user: User): string {
  const joined = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  if (user.username) return user.username;
  const email = user.emailAddresses?.[0]?.emailAddress;
  if (email) return email;
  return user.id;
}

async function clerkSummariesForUserIds(userIds: string[]): Promise<Map<string, { displayName: string; email: string | null }>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const out = new Map<string, { displayName: string; email: string | null }>();
  if (unique.length === 0) return out;
  const clerk = await clerkClient();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const u = await clerk.users.getUser(id);
        out.set(id, {
          displayName: clerkUserDisplayName(u),
          email: u.emailAddresses?.[0]?.emailAddress ?? null,
        });
      } catch {
        out.set(id, { displayName: id, email: null });
      }
    })
  );
  return out;
}

function paygProductLabel(itemType: string, lawId: string | null): string {
  switch (itemType) {
    case "document":
      return lawId ? `Library PDF unlock · law ${lawId}` : "Library PDF unlock";
    case "lawyer_search":
      return "Lawyer directory search unlock";
    case "ai_query":
      return "AI Research (pay-per-query)";
    case "afcfta_report":
      return "AfCFTA report (pay-per-use)";
    default:
      return itemType;
  }
}

function paygLineUsdCents(
  itemType: string,
  quantity: number | null,
  lawPrintPriceUsdCents: number
): number {
  const q = Math.max(1, Number(quantity ?? 1) || 1);
  if (itemType === "document") return q * lawPrintPriceUsdCents;
  if (itemType === "lawyer_search") return q * LAWYER_SEARCH_UNLOCK_USD_CENTS;
  if (itemType === "ai_query") return q * PAYG_AI_QUERY_USD_CENTS;
  if (itemType === "afcfta_report") return q * PAYG_AFCFTA_REPORT_USD_CENTS;
  return 0;
}

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
    const documentUnlockUsdCents = await getLawPrintPriceUsdCents();
    const documentRevenueUsdCents = documentUnits * documentUnlockUsdCents;

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

    const { data: mpDetailRows, error: mpDetailErr } = await (supabase.from("marketplace_purchases") as any)
      .select(
        `id, user_id, marketplace_item_id, stripe_session_id, created_at, marketplace_items ( title, price_cents )`
      )
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(DETAIL_LIMIT_VAULT);

    if (mpDetailErr) console.error("admin analytics marketplace_purchases detail:", mpDetailErr);

    const paygDetailTypes = ["document", "lawyer_search", "ai_query", "afcfta_report"];
    const { data: paygDetailRows, error: paygDetailErr } = await (supabase.from("pay_as_you_go_purchases") as any)
      .select("id, user_id, item_type, quantity, law_id, stripe_session_id, created_at")
      .in("item_type", paygDetailTypes)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(DETAIL_LIMIT_PAYG);

    if (paygDetailErr) console.error("admin analytics pay_as_you_go detail:", paygDetailErr);

    const users = await fetchAllClerkUsers();
    const fromMs = new Date(fromIso).getTime();
    const toMs = new Date(toIso).getTime();

    let activePaidSubscribers = 0;
    let estimatedMrrUsdCents = 0;
    let newSubscribersInRange = 0;
    let estimatedNewSubscriberRevenueUsdCents = 0;

    type NewSubRow = {
      userId: string;
      buyerLabel: string;
      buyerEmail: string | null;
      tier: string;
      billing: string;
      subscriberSince: string;
      estimatedFirstPaymentUsdCents: number;
      isComplimentaryGrant: boolean;
    };
    const newSubscriberDetails: NewSubRow[] = [];

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

      let estFirstCents = 0;
      if (!state.isSubscriptionGrant) {
        const tierPricesNew = priceBySlug.get(tier);
        if (tierPricesNew) {
          const intervalNew = state.interval === "annual" ? "annual" : "monthly";
          estFirstCents =
            intervalNew === "annual" ? tierPricesNew.annualUsdCents : tierPricesNew.monthlyUsdCents;
          estimatedNewSubscriberRevenueUsdCents += estFirstCents;
        }
      }

      newSubscriberDetails.push({
        userId: user.id,
        buyerLabel: clerkUserDisplayName(user),
        buyerEmail: user.emailAddresses?.[0]?.emailAddress ?? null,
        tier,
        billing: state.interval === "annual" ? "annual" : "monthly",
        subscriberSince: sinceRaw,
        estimatedFirstPaymentUsdCents: state.isSubscriptionGrant ? 0 : estFirstCents,
        isComplimentaryGrant: state.isSubscriptionGrant,
      });
    }

    newSubscriberDetails.sort(
      (a, b) => new Date(b.subscriberSince).getTime() - new Date(a.subscriberSince).getTime()
    );
    const newSubscriberDetailsLimited = newSubscriberDetails.slice(0, DETAIL_LIMIT_NEW_SUBS);

    const mpDetailTyped = (mpDetailRows ?? []) as Array<{
      id: string;
      user_id: string;
      marketplace_item_id: string;
      stripe_session_id: string | null;
      created_at: string;
      marketplace_items?: { title?: string | null; price_cents?: number | null } | null;
    }>;
    const paygDetailTyped = (paygDetailRows ?? []) as Array<{
      id: string;
      user_id: string;
      item_type: string;
      quantity: number | null;
      law_id: string | null;
      stripe_session_id: string | null;
      created_at: string;
    }>;

    const txUserIds = [
      ...mpDetailTyped.map((r) => r.user_id),
      ...paygDetailTyped.map((r) => r.user_id),
    ];
    const clerkTx = await clerkSummariesForUserIds(txUserIds);

    const vaultPurchaseLines = mpDetailTyped.map((row) => {
      const cents = Number(row.marketplace_items?.price_cents ?? 0);
      const priceUsdCents = Number.isFinite(cents) && cents > 0 ? Math.round(cents) : 0;
      const s = clerkTx.get(row.user_id);
      return {
        id: row.id,
        userId: row.user_id,
        buyerLabel: s?.displayName ?? row.user_id,
        buyerEmail: s?.email ?? null,
        itemId: row.marketplace_item_id,
        itemTitle: row.marketplace_items?.title ?? "(deleted item)",
        priceUsdCents,
        paymentRef: row.stripe_session_id,
        createdAt: row.created_at,
      };
    });

    const payAsYouGoLines = paygDetailTyped.map((row) => {
      const s = clerkTx.get(row.user_id);
      const lineUsdCents = paygLineUsdCents(row.item_type, row.quantity, documentUnlockUsdCents);
      return {
        id: row.id,
        userId: row.user_id,
        buyerLabel: s?.displayName ?? row.user_id,
        buyerEmail: s?.email ?? null,
        itemType: row.item_type,
        productLabel: paygProductLabel(row.item_type, row.law_id),
        quantity: Math.max(1, Number(row.quantity ?? 1) || 1),
        lawId: row.law_id,
        lineUsdCents,
        paymentRef: row.stripe_session_id,
        createdAt: row.created_at,
      };
    });

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
      details: {
        vaultPurchases: vaultPurchaseLines,
        payAsYouGo: payAsYouGoLines,
        newSubscribers: newSubscriberDetailsLimited,
        limits: {
          vaultPurchases: DETAIL_LIMIT_VAULT,
          payAsYouGo: DETAIL_LIMIT_PAYG,
          newSubscribers: DETAIL_LIMIT_NEW_SUBS,
        },
        truncated: {
          vaultPurchases: vaultCount > DETAIL_LIMIT_VAULT,
          payAsYouGo: paygDetailTyped.length >= DETAIL_LIMIT_PAYG,
          newSubscribers: newSubscriberDetails.length > DETAIL_LIMIT_NEW_SUBS,
        },
      },
      disclaimer:
        "Subscription MRR and new-subscriber revenue are list-price estimates from Admin → Pricing and Clerk metadata (not card-settled totals). Document, lawyer search, and Vault amounts use fixed list prices or item prices × purchase rows in Supabase. Activity tables show the most recent rows in the date window (capped per section); totals above include all matching rows.",
    });
  } catch (err) {
    console.error("admin analytics GET:", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
