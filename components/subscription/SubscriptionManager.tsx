"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Check, Loader2 } from "lucide-react";
import { useAlertDialog, useConfirm } from "@/components/ui/use-confirm";
import { PaymentMethodPicker, type CheckoutPaymentProvider } from "@/components/checkout/PaymentMethodPicker";
import { PawapayCountrySelect } from "@/components/checkout/PawapayCountrySelect";
import { DEFAULT_PAWAPAY_PAYMENT_COUNTRY } from "@/lib/pawapay-payment-countries";
import type { SubscriptionPublicState } from "@/lib/subscription-state";
import { getDisplayedBillingWindow } from "@/lib/subscription-billing-window";

type BillingInterval = "monthly" | "annual";

type Tier = {
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export type SubscriptionManagerProps = {
  /** Where this UI is mounted; used for URL cleanup after ?plan= deep links and payment cancel return. */
  basePath: "/subscription" | "/account/subscription";
  /** When true, omit the large page hero (e.g. under Account layout). */
  compact?: boolean;
};

export function SubscriptionManager({ basePath, compact = false }: SubscriptionManagerProps) {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert: showAlert, alertDialog } = useAlertDialog();
  const { confirm, confirmDialog } = useConfirm();

  const [billing, setBilling] = useState<BillingInterval>("monthly");
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [subState, setSubState] = useState<SubscriptionPublicState | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>("pawapay");
  const [pawapayPaymentCountry, setPawapayPaymentCountry] = useState(DEFAULT_PAWAPAY_PAYMENT_COUNTRY);

  const isAnnual = billing === "annual";
  const lomiAvailable =
    process.env.NEXT_PUBLIC_LOMI_CHECKOUT_ENABLED === "1" ||
    Boolean(process.env.NEXT_PUBLIC_LOMI_PUBLISHABLE_KEY?.trim());

  const refreshSubscription = useCallback(async () => {
    const res = await fetch("/api/subscription", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as SubscriptionPublicState;
    setSubState(data);
  }, []);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setTiers(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setLoadingState(false);
      return;
    }
    setLoadingState(true);
    refreshSubscription().finally(() => setLoadingState(false));
  }, [isLoaded, isSignedIn, refreshSubscription]);

  useEffect(() => {
    const plan = searchParams.get("plan");
    const interval = searchParams.get("interval") as BillingInterval | null;
    if (plan && ["basic", "pro", "team"].includes(plan)) {
      setSelectedPlan(plan);
      if (interval === "monthly" || interval === "annual") setBilling(interval);
      router.replace(basePath, { scroll: false });
    }
  }, [searchParams, router, basePath]);

  const paidTiers = useMemo(() => tiers.filter((t) => t.id !== "free"), [tiers]);

  const lowerTiersForDowngrade = useMemo(() => {
    if (!subState?.isPaid) return [];
    const order = ["basic", "pro", "team"];
    const idx = order.indexOf(subState.tier);
    if (idx <= 0) return [];
    return order.slice(0, idx);
  }, [subState]);

  const billingWindow = useMemo(() => {
    if (!subState?.isPaid) return null;
    return getDisplayedBillingWindow({
      periodStartIso: subState.periodStart,
      periodEndIso: subState.periodEnd,
      interval: subState.interval,
    });
  }, [subState?.isPaid, subState?.periodStart, subState?.periodEnd, subState?.interval]);

  const displayPeriodStart = billingWindow?.windowStartIso ?? subState?.periodStart ?? null;
  const displayPeriodEnd = billingWindow?.windowEndIso ?? subState?.periodEnd ?? null;

  const handlePay = async () => {
    if (!selectedPlan || !isSignedIn) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planId: selectedPlan,
          interval: billing,
          provider: paymentProvider,
          cancelPath: basePath,
          ...(paymentProvider === "pawapay" ? { paymentCountry: pawapayPaymentCountry } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        await showAlert(data.error || "Checkout failed", "Checkout");
        return;
      }
      if (data.upgraded) {
        await refreshSubscription();
        await showAlert("Your plan has been upgraded.", "Done");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      await showAlert("Something went wrong. Please try again.", "Checkout");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading("cancel");
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) {
        await showAlert(data.error || "Could not cancel", "Subscription");
        return;
      }
      await refreshSubscription();
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    setActionLoading("resume");
    try {
      await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "resume" }),
      });
      await refreshSubscription();
    } finally {
      setActionLoading(null);
    }
  };

  const [downgradeTarget, setDowngradeTarget] = useState<string>("");

  const handleScheduleDowngrade = async () => {
    if (!downgradeTarget) return;
    setActionLoading("downgrade");
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "schedule_downgrade", scheduledTier: downgradeTarget }),
      });
      const data = await res.json();
      if (!res.ok) {
        await showAlert(data.error || "Could not schedule change", "Subscription");
        return;
      }
      await refreshSubscription();
      await showAlert(
        `Starting next billing period, your plan will be ${downgradeTarget}. Until then you keep your current features.`,
        "Downgrade scheduled"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const signInRedirect = encodeURIComponent(basePath);

  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center ${compact ? "min-h-[24vh]" : "min-h-[40vh]"}`}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className={`mx-auto max-w-lg text-center ${compact ? "py-6" : "px-4 py-16"}`}>
        <h2 className="heading text-xl font-bold">Subscription</h2>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to manage your plan and checkout.</p>
        <Link
          href={`/sign-in?redirect_url=${signInRedirect}`}
          className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const shellClass = compact ? "max-w-full" : "mx-auto max-w-5xl px-4 py-10 sm:px-6";

  return (
    <div className={shellClass}>
      {alertDialog}
      {confirmDialog}

      {!compact && (
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billing</p>
          <h1 className="heading mt-1 text-3xl font-bold text-foreground">Subscription & checkout</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Choose monthly or annual billing, pay here, then manage upgrades, downgrades, and cancellation. Monthly and
            annual are prepaid periods (pay again when it renews). Cancelling turns off renewal — you keep access until
            the date shown.
          </p>
        </div>
      )}

      {loadingState ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <section className={`rounded-xl border border-border bg-card p-6 shadow-sm ${compact ? "mb-6" : "mb-10"}`}>
            <h2 className="text-lg font-semibold">Current plan</h2>
            {subState && (
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Tier:</span>{" "}
                  <span className="font-medium capitalize">{subState.tier}</span>
                </p>
                {subState.isPaid && (
                  <p>
                    <span className="text-muted-foreground">Paid with:</span>{" "}
                    <span className="font-medium">
                      {subState.paymentProvider === "pawapay"
                        ? "Mobile money (pawaPay)"
                        : subState.paymentProvider === "lomi"
                          ? "Card & wallets (Lomi)"
                          : subState.isSubscriptionGrant
                            ? "Plan grant (complimentary)"
                            : "Not recorded"}
                    </span>
                    {subState.isSubscriptionGrant && !subState.paymentProvider && (
                      <span className="text-muted-foreground">
                        {" "}
                        — your tier was assigned by an administrator without going through checkout.
                      </span>
                    )}
                    {!subState.isSubscriptionGrant && !subState.paymentProvider && (
                      <span className="text-muted-foreground">
                        {" "}
                        — not stored for this account (e.g. purchase before payment tracking).
                      </span>
                    )}
                  </p>
                )}
                {subState.isPaid && (subState.subscriberSince || subState.periodStart) && (
                  <p>
                    <span className="text-muted-foreground">Subscriber since:</span>{" "}
                    <span className="font-medium">
                      {formatDate(subState.subscriberSince ?? subState.periodStart)}
                    </span>
                    {!subState.subscriberSince && subState.periodStart && (
                      <span className="text-muted-foreground"> (from your first billing period on file)</span>
                    )}
                  </p>
                )}
                {displayPeriodStart && subState.isPaid && (
                  <p>
                    <span className="text-muted-foreground">Billing period starts:</span>{" "}
                    <span className="font-medium">{formatDate(displayPeriodStart)}</span>
                  </p>
                )}
                {displayPeriodEnd && subState.isPaid && (
                  <p>
                    <span className="text-muted-foreground">Billing period ends:</span>{" "}
                    <span className="font-medium">{formatDate(displayPeriodEnd)}</span>
                    {subState.interval && (
                      <span className="text-muted-foreground">
                        {" "}
                        ({subState.interval === "annual" ? "annual prepay" : "monthly billing period"})
                      </span>
                    )}
                  </p>
                )}
                {billingWindow?.accessThroughIso && subState.interval === "monthly" && (
                  <p className="text-xs text-muted-foreground">
                    Your prepaid access is recorded through {formatDate(billingWindow.accessThroughIso)}. The dates
                    above are the current monthly cycle for display.
                  </p>
                )}
                {subState.cancelAtPeriodEnd && (
                  <p className="rounded-md bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-100">
                    Renewal cancelled — you stay on your plan until {formatDate(subState.periodEnd)}, then access ends
                    unless you subscribe again.
                  </p>
                )}
                {subState.scheduledTier && (
                  <p className="rounded-md bg-muted px-3 py-2">
                    Scheduled change: after this period you&apos;ll move to{" "}
                    <span className="font-semibold capitalize">{subState.scheduledTier}</span>.
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {subState?.isPaid && !subState.cancelAtPeriodEnd && (
                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={async () => {
                    const ok = await confirm({
                      description:
                        "Cancel renewal? You’ll keep access until the end of the current billing period, then your plan ends unless you subscribe again.",
                      variant: "destructive",
                      confirmLabel: "Cancel renewal",
                    });
                    if (ok) await handleCancel();
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                >
                  {actionLoading === "cancel" ? "…" : "Cancel renewal"}
                </button>
              )}
              {subState?.cancelAtPeriodEnd && (
                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={handleResume}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {actionLoading === "resume" ? "…" : "Resume renewal"}
                </button>
              )}
            </div>

            {lowerTiersForDowngrade.length > 0 && (
              <div className="mt-8 border-t border-border pt-6">
                <h3 className="text-sm font-semibold">Schedule downgrade</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep your current features until the end of this billing period; the lower price applies next cycle.
                </p>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Move to</span>
                    <select
                      value={downgradeTarget}
                      onChange={(e) => setDowngradeTarget(e.target.value)}
                      className="mt-1 block w-full min-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Choose…</option>
                      {lowerTiersForDowngrade.map((id) => (
                        <option key={id} value={id}>
                          {id.charAt(0).toUpperCase() + id.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!downgradeTarget || actionLoading !== null}
                    onClick={handleScheduleDowngrade}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                  >
                    {actionLoading === "downgrade" ? "…" : "Schedule downgrade"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold">Billing period</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <strong>Monthly</strong> = pay each billing period. <strong>Annual</strong> = one payment for the full
              year. Upgrades charge a prorated difference for the time left in your current period.
            </p>
            <div className="mt-4 inline-flex rounded-full border border-border p-1">
              <button
                type="button"
                onClick={() => setBilling("monthly")}
                className={`rounded-full px-5 py-2 text-sm font-medium ${
                  !isAnnual ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilling("annual")}
                className={`rounded-full px-5 py-2 text-sm font-medium ${
                  isAnnual ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Annual
              </button>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold">Choose a plan</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {paidTiers.map((tier) => {
                const price =
                  tier.priceMonthly === 0 ? 0 : isAnnual ? tier.priceAnnualPerMonth : tier.priceMonthly;
                const selected = selectedPlan === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedPlan(tier.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="font-semibold">{tier.name}</div>
                    <div className="mt-2 text-2xl font-bold">
                      ${price}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </div>
                    {isAnnual && tier.priceMonthly > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">${tier.priceAnnualTotal} billed annually</p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Payment method</h2>
            <p className="mt-1 text-sm text-muted-foreground">Mobile money or card / wallets via Lomi — choose before paying.</p>
            <div className="mt-4 max-w-xl">
              <PaymentMethodPicker
                value={paymentProvider}
                onChange={setPaymentProvider}
                lomiAvailable={lomiAvailable}
              />
              {paymentProvider === "pawapay" && (
                <div className="mt-4">
                  <PawapayCountrySelect
                    id="subscription-pawapay-country"
                    label="Mobile money country"
                    value={pawapayPaymentCountry}
                    onChange={setPawapayPaymentCountry}
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={!selectedPlan || checkoutLoading}
              onClick={handlePay}
              className="mt-8 w-full max-w-md rounded-lg bg-[#0D1B2A] py-3 text-center font-semibold text-white hover:bg-[#162436] disabled:opacity-60 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            >
              {checkoutLoading ? "Starting checkout…" : "Continue to payment"}
            </button>
          </section>

          <section className="mt-10 rounded-lg border border-dashed border-border p-5">
            <h3 className="text-sm font-semibold">Compare features</h3>
            <div className="mt-4 grid gap-6 md:grid-cols-3">
              {paidTiers.map((tier) => (
                <div key={tier.id}>
                  <div className="font-medium">{tier.name}</div>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {tier.features.slice(0, 5).map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span dangerouslySetInnerHTML={{ __html: f }} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <Link href="/pricing" className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
              Full pricing details →
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
