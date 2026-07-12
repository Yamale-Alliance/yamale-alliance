"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { AiQueryPaygCheckoutDialog } from "@/components/ai-research/AiQueryPaygCheckoutDialog";
import {
  defaultCheckoutPaymentProvider,
  isLomiCheckoutAvailable,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import { MarketingDiscountSubscriptionPrice } from "@/components/pricing/MarketingDiscountPrice";
import { useAlertDialog } from "@/components/ui/use-confirm";
import {
  localizeAiPricingTiers,
  type LocalizedPricingTier,
  type PricingTierApi,
} from "@/lib/localized-pricing-tiers";
import { usePlatformSettings } from "@/components/platform/PlatformSettingsContext";
import { stashPaygAiQueryLomiSessionId } from "@/lib/lomi-payg-ai-query-return";

type BillingInterval = "monthly" | "annual";

const FALLBACK_API_TIERS: PricingTierApi[] = [
  {
    id: "basic",
    name: "Basic",
    priceMonthly: 5,
    priceAnnualPerMonth: 4,
    priceAnnualTotal: 50,
    description: "",
    features: [],
    cta: "Choose Basic",
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 15,
    priceAnnualPerMonth: 12,
    priceAnnualTotal: 150,
    description: "",
    features: [],
    cta: "Choose Pro",
    highlighted: true,
  },
  {
    id: "team",
    name: "Team",
    priceMonthly: 40,
    priceAnnualPerMonth: 33,
    priceAnnualTotal: 400,
    description: "",
    features: [],
    cta: "Choose Team",
  },
];

type Props = {
  /** When true, section title is rendered by the page header above. */
  compact?: boolean;
};

export function AiResearchPricingPanel({ compact = false }: Props) {
  const t = useTranslations("aiResearch.landing");
  const tPricing = useTranslations("pricing");
  const locale = useLocale();
  const { isLoaded, isSignedIn } = useAppUser();
  const router = useRouter();
  const [billing, setBilling] = useState<BillingInterval>("monthly");
  const [apiTiers, setApiTiers] = useState<PricingTierApi[]>(FALLBACK_API_TIERS);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [paygDialogOpen, setPaygDialogOpen] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>(
    defaultCheckoutPaymentProvider()
  );
  const { aiQueryPriceUsdCents } = usePlatformSettings();
  const { alert: showAlert, alertDialog } = useAlertDialog();
  const lomiAvailable = isLomiCheckoutAvailable();
  const lomiComingSoon = false;
  const isAnnual = billing === "annual";

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const aiTiers = data.filter((tier: PricingTierApi) =>
          ["basic", "pro", "team"].includes(tier.id)
        ) as PricingTierApi[];
        if (aiTiers.length > 0) setApiTiers(aiTiers);
      })
      .catch(() => {});
  }, [locale]);

  const tiers = useMemo(
    () => localizeAiPricingTiers(apiTiers, tPricing),
    [apiTiers, tPricing, locale]
  );

  const goToSubscriptionCheckout = (planId: string) => {
    if (!isLoaded) return;
    const destination = `/account/subscription?plan=${planId}&interval=${billing}`;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(destination)}`);
      return;
    }
    router.push(destination);
  };

  const openPaygCheckout = () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent("/ai-research")}`);
      return;
    }
    setPaygDialogOpen(true);
  };

  const handlePayAsYouGoAiQuery = async () => {
    if (!isLoaded || !isSignedIn) return;
    setCheckoutLoading("payg-ai");
    try {
      const res = await fetch("/api/payments/payg/ai-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider: "lomi",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setPaygDialogOpen(false);
          router.push(`/sign-in?redirect_url=${encodeURIComponent("/ai-research")}`);
          return;
        }
        await showAlert(data.error || "Checkout failed", "Checkout");
        return;
      }
      if (data.url) {
        if (
          paymentProvider === "lomi" &&
          typeof data.lomi_session_id === "string" &&
          data.lomi_session_id.trim()
        ) {
          stashPaygAiQueryLomiSessionId(data.lomi_session_id);
        }
        window.location.href = data.url;
      }
    } catch {
      await showAlert("Something went wrong. Please try again.", "Checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const paygPrice =
    aiQueryPriceUsdCents > 0 ? `$${(aiQueryPriceUsdCents / 100).toFixed(2)}` : "$2.00";

  return (
    <div className={compact ? "mx-auto w-full" : "mx-auto max-w-5xl"}>
      {!compact ? (
        <>
          <h2 className="heading text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("pricingTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
            {t("pricingSubtitle")}
          </p>
        </>
      ) : (
        <h2 className="sr-only">{t("pricingTitle")}</h2>
      )}

      <div className={`flex justify-center ${compact ? "mt-3" : "mt-6"}`}>
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 p-1">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              !isAnnual ? "bg-[#C8922A] text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("monthly")}
          </button>
          <button
            type="button"
            onClick={() => setBilling("annual")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              isAnnual ? "bg-[#C8922A] text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("annual")}
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-3 md:grid-cols-3 ${compact ? "mt-4" : "mt-8"}`}>
        {tiers.map((tier) => (
          <PricingTierCard
            key={tier.id}
            tier={tier}
            billing={billing}
            isAnnual={isAnnual}
            checkoutLoading={checkoutLoading}
            compact={compact}
            onChoose={() => goToSubscriptionCheckout(tier.id)}
            tLanding={t}
            tPricing={tPricing}
          />
        ))}
      </div>

      <div className={`rounded-xl border border-border bg-card text-center shadow-sm ${compact ? "mt-4 p-4" : "mt-8 p-5"}`}>
        <p className="text-sm font-semibold text-foreground">{t("paygTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("paygBody", { price: paygPrice })}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={openPaygCheckout}
            disabled={checkoutLoading !== null}
            className="inline-flex rounded-[6px] bg-[#0D1B2A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#162436] disabled:opacity-70"
          >
            {t("paygCta", { price: paygPrice })}
          </button>
          <Link
            href="/pricing"
            className="inline-flex rounded-[6px] border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            {t("fullPricing")}
          </Link>
        </div>
      </div>

      <AiQueryPaygCheckoutDialog
        open={paygDialogOpen}
        onOpenChange={setPaygDialogOpen}
        priceLabel={paygPrice}
        paymentProvider={paymentProvider}
        onPaymentProviderChange={setPaymentProvider}
        lomiAvailable={lomiAvailable}
        lomiComingSoon={lomiComingSoon}
        onLomiComingSoonClick={() => {
          void showAlert(
            "Credit card payments are coming soon. For now, please use Mobile Money.",
            "Coming soon"
          );
        }}
        loading={checkoutLoading === "payg-ai"}
        onCheckout={() => void handlePayAsYouGoAiQuery()}
      />
      {alertDialog}
    </div>
  );
}

function PricingTierCard({
  tier,
  billing,
  isAnnual,
  checkoutLoading,
  compact = false,
  onChoose,
  tLanding,
  tPricing,
}: {
  tier: LocalizedPricingTier;
  billing: BillingInterval;
  isAnnual: boolean;
  checkoutLoading: string | null;
  compact?: boolean;
  onChoose: () => void;
  tLanding: ReturnType<typeof useTranslations<"aiResearch.landing">>;
  tPricing: ReturnType<typeof useTranslations<"pricing">>;
}) {
  const price =
    tier.priceMonthly === 0 ? 0 : isAnnual ? tier.priceAnnualPerMonth : tier.priceMonthly;
  const annualNote =
    tier.priceMonthly > 0 && isAnnual
      ? tPricing("billedAnnually", {
          total: tier.priceAnnualTotal,
          amount: tier.priceMonthly * 12 - tier.priceAnnualTotal,
        })
      : null;

  return (
    <div
      className={`relative flex flex-col rounded-xl border transition ${
        tier.highlighted
          ? "border-[#0D1B2A] bg-[#0D1B2A] text-white shadow-lg"
          : "border-border bg-card shadow-sm"
      }`}
    >
      {tier.highlighted ? (
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#C8922A] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          {tLanding("mostPopular")}
        </div>
      ) : null}
      <div className={`flex flex-1 flex-col ${compact ? "p-4" : "p-5 sm:p-6"}`}>
        <h3 className={`heading font-bold ${compact ? "text-base" : "text-lg"} ${tier.highlighted ? "text-white" : "text-foreground"}`}>
          {tier.localizedName}
        </h3>
        <div className="mb-2 mt-2">
          <MarketingDiscountSubscriptionPrice
            currentUsd={price}
            period={tPricing("perMonth")}
            highlighted={tier.highlighted}
          />
        </div>
        {annualNote ? (
          <p
            className={`mb-3 text-xs font-medium ${tier.highlighted ? "text-white/70" : "text-primary/90"}`}
          >
            {annualNote}
          </p>
        ) : null}
        <ul className={`flex-1 space-y-1.5 ${compact ? "mb-3 text-xs" : "mb-5 space-y-2 text-sm"}`}>
          {tier.localizedFeatures.slice(0, compact ? 4 : 5).map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check
                className={`mt-0.5 h-4 w-4 shrink-0 ${tier.highlighted ? "text-[#E8B84B]" : "text-primary"}`}
                strokeWidth={3}
              />
              <span
                dangerouslySetInnerHTML={{ __html: feature }}
                className={tier.highlighted ? "text-white/90" : "text-foreground"}
              />
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onChoose}
          disabled={checkoutLoading !== null}
          className={`w-full rounded-[6px] py-2.5 text-sm font-semibold transition disabled:opacity-70 ${
            tier.highlighted
              ? "bg-[#C8922A] text-white hover:bg-[#b07e22]"
              : "border border-border bg-background text-foreground hover:border-[#d8c5a1]"
          }`}
        >
          {checkoutLoading === tier.id ? tLanding("redirecting") : tier.localizedCta}
        </button>
      </div>
    </div>
  );
}
