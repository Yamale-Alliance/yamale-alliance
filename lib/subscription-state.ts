import { clerkClient } from "@clerk/nextjs/server";

export type PaidTier = "basic" | "pro" | "team";
export type BillingInterval = "monthly" | "annual";

const PAID: PaidTier[] = ["basic", "pro", "team"];

const TIER_RANK: Record<string, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  team: 3,
};

export function tierRank(tier: string): number {
  return TIER_RANK[tier] ?? 0;
}

export function isPaidTier(tier: string): tier is PaidTier {
  return PAID.includes(tier as PaidTier);
}

export function addBillingPeriod(start: Date, interval: BillingInterval): Date {
  const d = new Date(start.getTime());
  if (interval === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** When `subscription_period_start` is missing (legacy), infer from end + interval. */
export function inferPeriodStartFromEnd(periodEnd: Date, interval: BillingInterval): Date {
  const d = new Date(periodEnd.getTime());
  if (interval === "annual") d.setFullYear(d.getFullYear() - 1);
  else d.setMonth(d.getMonth() - 1);
  return d;
}

export type SubscriptionPublicState = {
  tier: string;
  periodStart: string | null;
  periodEnd: string | null;
  interval: BillingInterval | null;
  cancelAtPeriodEnd: boolean;
  scheduledTier: string | null;
  isPaid: boolean;
};

export function readSubscriptionState(meta: Record<string, unknown> | undefined): SubscriptionPublicState {
  const m = meta ?? {};
  const tier = (m.tier ?? m.subscriptionTier ?? "free") as string;
  const t = typeof tier === "string" ? tier : "free";
  const intervalRaw = m.subscription_interval;
  const interval: BillingInterval | null =
    intervalRaw === "annual" || intervalRaw === "monthly" ? intervalRaw : null;
  return {
    tier: t,
    periodStart: typeof m.subscription_period_start === "string" ? m.subscription_period_start : null,
    periodEnd: typeof m.subscription_period_end === "string" ? m.subscription_period_end : null,
    interval,
    cancelAtPeriodEnd: m.subscription_cancel_at_period_end === true,
    scheduledTier: typeof m.subscription_scheduled_tier === "string" ? m.subscription_scheduled_tier : null,
    isPaid: isPaidTier(t),
  };
}

/**
 * At period end: apply scheduled downgrade, or cancel → free, or lapse → free (no stored payment renewal).
 */
export async function applySubscriptionPeriodTransitions(userId: string): Promise<void> {
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
  const endRaw = existing.subscription_period_end;
  if (!endRaw || typeof endRaw !== "string") return;
  const end = new Date(endRaw);
  if (Number.isNaN(end.getTime()) || end.getTime() > Date.now()) return;

  const interval: BillingInterval =
    existing.subscription_interval === "annual" ? "annual" : "monthly";
  const scheduled = existing.subscription_scheduled_tier as string | undefined;
  const cancelled = existing.subscription_cancel_at_period_end === true;

  if (scheduled && PAID.includes(scheduled as PaidTier)) {
    const nextMeta: Record<string, unknown> = { ...existing, tier: scheduled };
    if (scheduled === "team") {
      nextMeta.team_admin = true;
      nextMeta.team_extra_seats = (existing.team_extra_seats as number) ?? 0;
    }
    const start = new Date();
    nextMeta.subscription_period_start = start.toISOString();
    nextMeta.subscription_period_end = addBillingPeriod(start, interval).toISOString();
    delete nextMeta.subscription_scheduled_tier;
    nextMeta.subscription_cancel_at_period_end = false;
    await clerk.users.updateUserMetadata(userId, { publicMetadata: nextMeta });
    return;
  }

  if (cancelled) {
    const nextMeta: Record<string, unknown> = { ...existing, tier: "free" };
    delete nextMeta.subscription_period_start;
    delete nextMeta.subscription_period_end;
    delete nextMeta.subscription_interval;
    delete nextMeta.subscription_cancel_at_period_end;
    delete nextMeta.subscription_scheduled_tier;
    await clerk.users.updateUserMetadata(userId, { publicMetadata: nextMeta });
    return;
  }

  const nextMeta: Record<string, unknown> = { ...existing, tier: "free" };
  delete nextMeta.subscription_period_start;
  delete nextMeta.subscription_period_end;
  delete nextMeta.subscription_interval;
  delete nextMeta.subscription_cancel_at_period_end;
  delete nextMeta.subscription_scheduled_tier;
  await clerk.users.updateUserMetadata(userId, { publicMetadata: nextMeta });
}

export async function fulfillSubscriptionPlanPayment(
  clerkUserId: string,
  meta: { plan_id: string; interval?: string; change_type?: string }
): Promise<void> {
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(clerkUserId);
  const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
  const planId = meta.plan_id;
  const interval: BillingInterval = meta.interval === "annual" ? "annual" : "monthly";

  if (!PAID.includes(planId as PaidTier)) return;

  const now = new Date();

  if (meta.change_type === "upgrade") {
    const nextMeta: Record<string, unknown> = {
      ...existing,
      tier: planId,
      subscription_interval: interval,
      subscription_cancel_at_period_end: false,
    };
    delete nextMeta.subscription_scheduled_tier;
    if (planId === "team") {
      nextMeta.team_admin = true;
      nextMeta.team_extra_seats = (existing.team_extra_seats as number) ?? 0;
    }
    await clerk.users.updateUserMetadata(clerkUserId, { publicMetadata: nextMeta });
    return;
  }

  const periodStart = now;
  const periodEnd = addBillingPeriod(periodStart, interval);
  const nextMeta: Record<string, unknown> = {
    ...existing,
    tier: planId,
    subscription_period_start: periodStart.toISOString(),
    subscription_period_end: periodEnd.toISOString(),
    subscription_interval: interval,
    subscription_cancel_at_period_end: false,
  };
  delete nextMeta.subscription_scheduled_tier;
  if (planId === "team") {
    nextMeta.team_admin = true;
    nextMeta.team_extra_seats = (existing.team_extra_seats as number) ?? 0;
  }
  await clerk.users.updateUserMetadata(clerkUserId, { publicMetadata: nextMeta });
}

export function computeUpgradeProrationUsdCents(params: {
  periodStart: Date;
  periodEnd: Date;
  oldPriceUsdCents: number;
  newPriceUsdCents: number;
}): number {
  const { periodStart, periodEnd, oldPriceUsdCents, newPriceUsdCents } = params;
  const diff = newPriceUsdCents - oldPriceUsdCents;
  if (diff <= 0) return 0;
  const total = periodEnd.getTime() - periodStart.getTime();
  if (total <= 0) return Math.max(0, diff);
  const remaining = periodEnd.getTime() - Date.now();
  if (remaining <= 0) return Math.max(0, diff);
  const ratio = Math.min(1, remaining / total);
  return Math.max(0, Math.round(diff * ratio));
}
