import type { BillingInterval } from "@/lib/subscription-state";

/** If stored [start,end] is longer than this (days), treat monthly as multi-month and show the current month slice only. */
const MONTHLY_SINGLE_WINDOW_MAX_DAYS = 40;

export type DisplayedBillingWindow = {
  windowStartIso: string;
  windowEndIso: string;
  /** Original `subscription_period_end` when we show a one-month slice inside a longer monthly contract. */
  accessThroughIso?: string;
};

function addOneMonth(d: Date): Date {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() + 1);
  return x;
}

/**
 * For **monthly** plans, if Clerk stores a long prepaid range (e.g. grant Feb–May), show only the **current**
 * calendar month window (e.g. Mar 6–Apr 6) so the page matches “one month per cycle”.
 * **Annual** (or short monthly ranges) returns the stored start/end unchanged.
 */
export function getDisplayedBillingWindow(params: {
  periodStartIso: string | null;
  periodEndIso: string | null;
  interval: BillingInterval | null;
  now?: Date;
}): DisplayedBillingWindow | null {
  const { periodStartIso, periodEndIso, interval, now = new Date() } = params;
  if (!periodStartIso || !periodEndIso || !interval) return null;

  const s = new Date(periodStartIso);
  const e = new Date(periodEndIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e.getTime() <= s.getTime()) return null;

  if (interval === "annual") {
    return { windowStartIso: periodStartIso, windowEndIso: periodEndIso };
  }

  const spanDays = (e.getTime() - s.getTime()) / 86_400_000;
  if (spanDays <= MONTHLY_SINGLE_WINDOW_MAX_DAYS) {
    return { windowStartIso: periodStartIso, windowEndIso: periodEndIso };
  }

  const accessThroughIso = periodEndIso;

  if (now.getTime() < s.getTime()) {
    const end = addOneMonth(s).getTime() > e.getTime() ? e : addOneMonth(s);
    return { windowStartIso: s.toISOString(), windowEndIso: end.toISOString(), accessThroughIso };
  }

  if (now.getTime() >= e.getTime()) {
    let wStart = new Date(s.getTime());
    while (true) {
      const n = addOneMonth(wStart);
      if (n.getTime() >= e.getTime()) {
        return { windowStartIso: wStart.toISOString(), windowEndIso: e.toISOString(), accessThroughIso };
      }
      wStart = n;
    }
  }

  let wStart = new Date(s.getTime());
  while (true) {
    const next = addOneMonth(wStart);
    if (next.getTime() > e.getTime()) {
      return { windowStartIso: wStart.toISOString(), windowEndIso: e.toISOString(), accessThroughIso };
    }
    if (now.getTime() < next.getTime()) {
      return { windowStartIso: wStart.toISOString(), windowEndIso: next.toISOString(), accessThroughIso };
    }
    wStart = next;
  }
}
