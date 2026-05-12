"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { getSubscriptionRenewalReminder } from "@/lib/subscription-renewal-reminder";

export function SubscriptionRenewalReminder() {
  const { isLoaded, isSignedIn, user } = useUser();

  const info = useMemo(() => {
    if (!isLoaded || !isSignedIn || !user?.publicMetadata) return null;
    return getSubscriptionRenewalReminder(user.publicMetadata as Record<string, unknown>);
  }, [isLoaded, isSignedIn, user?.publicMetadata]);

  if (!info) return null;

  const endDate = new Date(info.periodEndIso);
  const endLabel = endDate.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      role="region"
      aria-label="Subscription renewal reminder"
      className="border-b border-[#C8922A]/35 bg-gradient-to-r from-[#C8922A]/12 via-amber-500/10 to-[#C8922A]/8 px-4 py-3 print:hidden dark:from-[#C8922A]/20 dark:via-amber-500/15 dark:to-[#C8922A]/12"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 text-sm leading-snug text-foreground">
          {info.cancelAtPeriodEnd ? (
            <>
              <span className="font-semibold">Your plan ends in {info.daysLeft} day{info.daysLeft === 1 ? "" : "s"}</span>{" "}
              ({endLabel}). Renewal is off — resubscribe before then to keep your benefits.
            </>
          ) : (
            <>
              <span className="font-semibold">Billing period ends in {info.daysLeft} day{info.daysLeft === 1 ? "" : "s"}</span>{" "}
              ({endLabel}). Check your payment method so your <span className="capitalize">{info.tier}</span> plan renews without interruption.
            </>
          )}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/account/subscription"
            className="inline-flex items-center justify-center rounded-lg bg-[#C8922A] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#b07e22]"
          >
            Manage subscription
          </Link>
        </div>
      </div>
    </div>
  );
}
