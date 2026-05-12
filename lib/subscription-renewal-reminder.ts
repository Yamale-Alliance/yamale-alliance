const PAID = new Set(["basic", "pro", "team"]);

/** Show reminder when this many days or fewer remain until period end (inclusive). */
export const SUBSCRIPTION_RENEWAL_REMINDER_DAYS = 5;

export type SubscriptionRenewalReminderInfo = {
  daysLeft: number;
  periodEndIso: string;
  cancelAtPeriodEnd: boolean;
  tier: string;
};

/**
 * Whether to show a renewal / payment reminder for a paid plan.
 * Uses Clerk publicMetadata fields written by subscription flows (`subscription_period_end`, etc.).
 */
export function getSubscriptionRenewalReminder(
  meta: Record<string, unknown> | undefined | null
): SubscriptionRenewalReminderInfo | null {
  const m = meta ?? {};
  const tier = String(m.tier ?? m.subscriptionTier ?? "free").toLowerCase();
  if (!PAID.has(tier)) return null;

  const endRaw = m.subscription_period_end;
  if (typeof endRaw !== "string") return null;
  const periodEnd = new Date(endRaw);
  if (Number.isNaN(periodEnd.getTime())) return null;

  const now = Date.now();
  if (periodEnd.getTime() <= now) return null;

  const msPerDay = 86_400_000;
  const daysLeft = Math.ceil((periodEnd.getTime() - now) / msPerDay);
  if (daysLeft < 1 || daysLeft > SUBSCRIPTION_RENEWAL_REMINDER_DAYS) return null;

  return {
    daysLeft,
    periodEndIso: periodEnd.toISOString(),
    cancelAtPeriodEnd: m.subscription_cancel_at_period_end === true,
    tier,
  };
}
