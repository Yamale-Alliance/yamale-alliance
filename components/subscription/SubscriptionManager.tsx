"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MarketingDiscountSubscriptionPrice } from "@/components/pricing/MarketingDiscountPrice";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { Check, Loader2 } from "lucide-react";
import { useAlertDialog, useConfirm } from "@/components/ui/use-confirm";
import {
  PaymentMethodPicker,
  defaultCheckoutPaymentProvider,
  isLomiCheckoutAvailable,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
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

const PAID_TIER_IDS = ["basic", "pro", "team"] as const;

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function tierLabel(
  tPricing: ReturnType<typeof useTranslations<"pricing">>,
  tierId: string
): string {
  if ((PAID_TIER_IDS as readonly string[]).includes(tierId) || tierId === "free") {
    return tPricing(`tiers.${tierId as "free" | "basic" | "pro" | "team"}`);
  }
  return tierId.charAt(0).toUpperCase() + tierId.slice(1);
}

export type SubscriptionManagerProps = {
  /** Where this UI is mounted; used for URL cleanup after ?plan= deep links and payment cancel return. */
  basePath: "/subscription" | "/account/subscription";
  /** When true, omit the large page hero (e.g. under Account layout). */
  compact?: boolean;
};

export function SubscriptionManager({ basePath, compact = false }: SubscriptionManagerProps) {
  const t = useTranslations("subscriptionManager");
  const tCommon = useTranslations("common");
  const tPricing = useTranslations("pricing");
  const locale = useLocale();
  const { isLoaded, isSignedIn } = useAppUser();
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

  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>(
    defaultCheckoutPaymentProvider()
  );
  const [pawapayPaymentCountry, setPawapayPaymentCountry] = useState(DEFAULT_PAWAPAY_PAYMENT_COUNTRY);

  const isAnnual = billing === "annual";
  const lomiAvailable = isLomiCheckoutAvailable();

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
    if (subState?.isPaid && (subState.interval === "monthly" || subState.interval === "annual")) {
      setBilling(subState.interval);
    }
  }, [subState?.isPaid, subState?.interval]);

  useEffect(() => {
    const plan = searchParams.get("plan");
    const interval = searchParams.get("interval") as BillingInterval | null;
    if (plan && ["basic", "pro", "team"].includes(plan)) {
      setSelectedPlan(plan);
      if (interval === "monthly" || interval === "annual") setBilling(interval);
      router.replace(basePath, { scroll: false });
    }
  }, [searchParams, router, basePath]);

  const paidTiers = useMemo(() => tiers.filter((tier) => tier.id !== "free"), [tiers]);

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
        await showAlert(data.error || t("checkoutFailed"), t("checkoutTitle"));
        return;
      }
      if (data.upgraded) {
        await refreshSubscription();
        await showAlert(t("upgraded"), t("done"));
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      await showAlert(t("somethingWrong"), t("checkoutTitle"));
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
        await showAlert(data.error || t("couldNotCancel"), t("subscriptionDialogTitle"));
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
        await showAlert(data.error || t("couldNotSchedule"), t("subscriptionDialogTitle"));
        return;
      }
      await refreshSubscription();
      await showAlert(
        t("downgradeScheduledMessage", { tier: tierLabel(tPricing, downgradeTarget) }),
        t("downgradeScheduled")
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
        <h2 className="heading text-xl font-bold">{t("title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("signInDesc")}</p>
        <Link
          href={`/sign-in?redirect_url=${signInRedirect}`}
          className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground"
        >
          {tCommon("signIn")}
        </Link>
      </div>
    );
  }

  const shellClass = compact ? "max-w-full" : "mx-auto max-w-5xl px-4 py-10 sm:px-6";
  const intervalLabel =
    subState?.interval === "annual" ? t("annual").toLowerCase() : t("monthly").toLowerCase();

  return (
    <div className={shellClass}>
      {alertDialog}
      {confirmDialog}

      {!compact && (
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("billingEyebrow")}
          </p>
          <h1 className="heading mt-1 text-3xl font-bold text-foreground">{t("pageTitle")}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t("pageDesc")}</p>
        </div>
      )}

      {loadingState ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <section className={`rounded-xl border border-border bg-card p-6 shadow-sm ${compact ? "mb-6" : "mb-10"}`}>
            <h2 className="text-lg font-semibold">{t("currentPlan")}</h2>
            {subState && (
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">{t("tier")}</span>{" "}
                  <span className="font-medium">{tierLabel(tPricing, subState.tier)}</span>
                </p>
                {subState.isPaid && (
                  <p>
                    <span className="text-muted-foreground">{t("paidWith")}</span>{" "}
                    <span className="font-medium">
                      {subState.paymentProvider === "pawapay"
                        ? t("paymentPawapay")
                        : subState.paymentProvider === "lomi"
                          ? t("paymentLomi")
                          : subState.isSubscriptionGrant
                            ? t("paymentGrant")
                            : t("paymentNotRecorded")}
                    </span>
                    {subState.isSubscriptionGrant && !subState.paymentProvider && (
                      <span className="text-muted-foreground"> {t("grantNote")}</span>
                    )}
                    {!subState.isSubscriptionGrant && !subState.paymentProvider && (
                      <span className="text-muted-foreground"> {t("notStoredNote")}</span>
                    )}
                  </p>
                )}
                {subState.isPaid && (subState.subscriberSince || subState.periodStart) && (
                  <p>
                    <span className="text-muted-foreground">{t("subscriberSince")}</span>{" "}
                    <span className="font-medium">
                      {formatDate(subState.subscriberSince ?? subState.periodStart, locale)}
                    </span>
                    {!subState.subscriberSince && subState.periodStart && (
                      <span className="text-muted-foreground"> {t("fromFirstPeriod")}</span>
                    )}
                  </p>
                )}
                {displayPeriodStart && subState.isPaid && (
                  <p>
                    <span className="text-muted-foreground">{t("periodStarts")}</span>{" "}
                    <span className="font-medium">{formatDate(displayPeriodStart, locale)}</span>
                  </p>
                )}
                {displayPeriodEnd && subState.isPaid && (
                  <p>
                    <span className="text-muted-foreground">{t("periodEnds")}</span>{" "}
                    <span className="font-medium">{formatDate(displayPeriodEnd, locale)}</span>
                    {subState.interval && (
                      <span className="text-muted-foreground">
                        {" "}
                        (
                        {subState.interval === "annual" ? t("annualPrepay") : t("monthlyPeriod")})
                      </span>
                    )}
                  </p>
                )}
                {billingWindow?.accessThroughIso && subState.interval === "monthly" && (
                  <p className="text-xs text-muted-foreground">
                    {t("prepaidAccessNote", {
                      date: formatDate(billingWindow.accessThroughIso, locale),
                    })}
                  </p>
                )}
                {subState.cancelAtPeriodEnd && (
                  <p className="rounded-md bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-100">
                    {t("renewalCancelled", {
                      date: formatDate(subState.periodEnd, locale),
                    })}
                  </p>
                )}
                {subState.scheduledTier && (
                  <p className="rounded-md bg-muted px-3 py-2">
                    {t("scheduledChange", {
                      tier: tierLabel(tPricing, subState.scheduledTier),
                    })}
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
                      description: t("cancelRenewalConfirm"),
                      variant: "destructive",
                      confirmLabel: t("cancelRenewal"),
                    });
                    if (ok) await handleCancel();
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                >
                  {actionLoading === "cancel" ? t("working") : t("cancelRenewal")}
                </button>
              )}
              {subState?.cancelAtPeriodEnd && (
                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={handleResume}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {actionLoading === "resume" ? t("working") : t("resumeRenewal")}
                </button>
              )}
            </div>

            {lowerTiersForDowngrade.length > 0 && (
              <div className="mt-8 border-t border-border pt-6">
                <h3 className="text-sm font-semibold">{t("scheduleDowngrade")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("scheduleDowngradeDesc")}</p>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="block">
                    <span className="text-xs text-muted-foreground">{t("moveTo")}</span>
                    <select
                      value={downgradeTarget}
                      onChange={(e) => setDowngradeTarget(e.target.value)}
                      className="mt-1 block w-full min-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">{t("choose")}</option>
                      {lowerTiersForDowngrade.map((id) => (
                        <option key={id} value={id}>
                          {tierLabel(tPricing, id)}
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
                    {actionLoading === "downgrade" ? t("working") : t("scheduleDowngrade")}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold">{t("billingPeriod")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("billingPeriodDesc")}</p>
            {subState?.isPaid && subState.interval && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("upgradesUseInterval", { interval: intervalLabel })}
              </p>
            )}
            <div className="mt-4 inline-flex rounded-full border border-border p-1">
              <button
                type="button"
                onClick={() => setBilling("monthly")}
                disabled={subState?.isPaid === true && subState.interval === "annual"}
                className={`rounded-full px-5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                  !isAnnual ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {t("monthly")}
              </button>
              <button
                type="button"
                onClick={() => setBilling("annual")}
                disabled={subState?.isPaid === true && subState.interval === "monthly"}
                className={`rounded-full px-5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                  isAnnual ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {t("annual")}
              </button>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold">{t("choosePlan")}</h2>
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
                    <div className="mt-2">
                      <MarketingDiscountSubscriptionPrice currentUsd={price} period="/mo" />
                    </div>
                    {isAnnual && tier.priceMonthly > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("billedAnnually", { total: tier.priceAnnualTotal })}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">{t("paymentMethod")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("paymentMethodDesc")}</p>
            <div className="mt-4 max-w-xl">
              <PaymentMethodPicker
                value={paymentProvider}
                onChange={setPaymentProvider}
                lomiAvailable={lomiAvailable}
                hideLabel
              />
              {paymentProvider === "pawapay" && (
                <div className="mt-4">
                  <PawapayCountrySelect
                    id="subscription-pawapay-country"
                    label={t("mobileMoneyCountry")}
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
              {checkoutLoading ? t("startingCheckout") : t("continueToPayment")}
            </button>
          </section>

          <section className="mt-10 rounded-lg border border-dashed border-border p-5">
            <h3 className="text-sm font-semibold">{t("compareFeatures")}</h3>
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
            <Link
              href="/pricing"
              className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("fullPricingDetails")}
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
