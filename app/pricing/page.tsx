"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useAlertDialog } from "@/components/ui/use-confirm";
import { PaymentMethodPicker, type CheckoutPaymentProvider } from "@/components/checkout/PaymentMethodPicker";
import { PawapayCountrySelect } from "@/components/checkout/PawapayCountrySelect";
import { DEFAULT_PAWAPAY_PAYMENT_COUNTRY } from "@/lib/pawapay-payment-countries";
import {
  PROTOTYPE_HERO_GRID_PATTERN,
  prototypeHeroEyebrowClass,
  prototypeNavyHeroSectionClass,
} from "@/components/layout/prototype-page-styles";

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

const FALLBACK_TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceAnnualPerMonth: 0,
    priceAnnualTotal: 0,
    description: "Explore African law",
    features: [
      "Unlimited browsing of full texts of laws",
      "Save up to 10 documents for easy access",
      "Browse lawyer directory",
      "Browse The Yamale Vault",
    ],
    cta: "Get Started Free",
  },
  {
    id: "basic",
    name: "Basic",
    priceMonthly: 5,
    priceAnnualPerMonth: 4,
    priceAnnualTotal: 50,
    description: "",
    subtitle: "or $50/year (save $10)",
    features: [
      "Unlimited browsing of full texts of laws",
      "<strong>5 document downloads/month</strong>",
      "<strong>Basic level AI queries/month</strong> (limited)",
      "<strong>1 AfCFTA report/month</strong> (view &amp; download)",
      "Browse lawyer directory",
      "Browse The Yamale Vault",
    ],
    cta: "Choose Basic",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 15,
    priceAnnualPerMonth: 12,
    priceAnnualTotal: 150,
    description: "",
    subtitle: "or $150/year (save $30)",
    features: [
      "Unlimited browsing of full texts of laws",
      "<strong>20 document downloads/month</strong>",
      "<strong>Pro level AI queries/month</strong> (limited)",
      "<strong>5 AfCFTA reports/month</strong> (view &amp; download)",
      "Browse lawyer directory",
      "Browse The Yamale Vault",
      "Download AI conversation",
    ],
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
    subtitle: "or $400/year (save $80)",
    features: [
      "<strong>5 user seats included</strong>",
      "<strong>25 document downloads per user/month</strong>",
      "<strong>Team level AI queries per user/month</strong> (limited)",
      "<strong>2 AfCFTA reports per user/month</strong> (view &amp; download)",
      "Browse lawyer directory",
      "Browse The Yamale Vault",
      "Download AI conversation",
      "<strong>Additional user: $6/month each</strong>",
    ],
    cta: "Choose Team",
  },
];

const FAQ_ITEMS = [
  {
    q: "How does pay-as-you-go work?",
    a: "All users (including free) can purchase additional documents, AI queries, lawyer contacts, and reports at the rates shown above. Subscribers get lower rates and included usage each month.",
  },
  {
    q: "Can I change plans anytime?",
    a: "Yes! Upgrade or downgrade at any time. When upgrading, you pay the prorated difference. When downgrading, the change takes effect at your next billing cycle.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept credit cards, debit cards, mobile money (M-Pesa, Orange Money, MTN, Airtel), and bank transfers for institutional accounts.",
  },
  {
    q: "What happens after I use my included amount?",
    a: "You can purchase additional usage at the pay-as-you-go rates shown for your tier, or upgrade to a higher tier for more included usage.",
  },
];

export default function PricingPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [billing, setBilling] = useState<BillingInterval>("monthly");
  const [tiers, setTiers] = useState<Tier[]>(FALLBACK_TIERS);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>("pawapay");
  const [pawapayPaymentCountry, setPawapayPaymentCountry] = useState(DEFAULT_PAWAPAY_PAYMENT_COUNTRY);
  const isAnnual = billing === "annual";
  const { alert: showAlert, alertDialog } = useAlertDialog();
  const lomiAvailable =
    process.env.NEXT_PUBLIC_LOMI_CHECKOUT_ENABLED === "1" ||
    Boolean(process.env.NEXT_PUBLIC_LOMI_PUBLISHABLE_KEY?.trim());

  /** Subscription checkout happens under Account (plan, billing period, payment method). */
  const goToSubscriptionCheckout = (planId: string) => {
    if (planId === "free") return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(
        `/sign-in?redirect_url=${encodeURIComponent(`/account/subscription?plan=${planId}&interval=${billing}`)}`
      );
      return;
    }
    router.push(`/account/subscription?plan=${planId}&interval=${billing}`);
  };
  
  const handleDayPassCheckout = async (provider: CheckoutPaymentProvider = paymentProvider) => {
    // Check if user is signed in
    if (!isLoaded) return; // Wait for auth to load
    if (!isSignedIn) {
      // Redirect to sign-in with return URL
      const returnUrl = encodeURIComponent(`/pricing?day_pass=true&provider=${provider}`);
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    setCheckoutLoading("day-pass");
    try {
      const res = await fetch("/api/stripe/day-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider,
          ...(provider === "pawapay" ? { paymentCountry: pawapayPaymentCountry } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // If 401, redirect to sign-in
        if (res.status === 401) {
          const returnUrl = encodeURIComponent(`/pricing?day_pass=true&provider=${provider}`);
          router.push(`/sign-in?redirect_url=${returnUrl}`);
          return;
        }
        await showAlert(data.error || "Checkout failed", "Checkout");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      await showAlert("Something went wrong. Please try again.", "Checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePayAsYouGoCheckout = async (
    itemType: "document" | "ai_query" | "afcfta_report",
    provider: CheckoutPaymentProvider = paymentProvider
  ) => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      const returnUrl = encodeURIComponent(`/pricing?payg=${itemType}&provider=${provider}`);
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    setCheckoutLoading(`payg-${itemType}`);
    try {
      const endpointMap = {
        document: "/api/stripe/payg/document",
        ai_query: "/api/stripe/payg/ai-query",
        afcfta_report: "/api/stripe/payg/afcfta-report",
      };
      const res = await fetch(endpointMap[itemType], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider,
          ...(provider === "pawapay" ? { paymentCountry: pawapayPaymentCountry } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          const returnUrl = encodeURIComponent(`/pricing?payg=${itemType}&provider=${provider}`);
          router.push(`/sign-in?redirect_url=${returnUrl}`);
          return;
        }
        await showAlert(data.error || "Checkout failed", "Checkout");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      await showAlert("Something went wrong. Please try again.", "Checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setTiers(data);
      })
      .catch(() => {});
  }, []);

  // Auto-trigger checkout if user returns from sign-in with plan selected
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    const interval = params.get("interval") as BillingInterval | null;
    const dayPass = params.get("day_pass");
    const providerParam = params.get("provider");
    const provider: CheckoutPaymentProvider =
      providerParam === "lomi" && lomiAvailable ? "lomi" : "pawapay";

    setPaymentProvider(provider);

    if (plan && ["basic", "pro", "team"].includes(plan)) {
      const iv = interval === "monthly" || interval === "annual" ? interval : "monthly";
      const timeoutId = setTimeout(() => {
        router.replace(`/account/subscription?plan=${plan}&interval=${iv}`);
      }, 50);
      window.history.replaceState({}, "", "/pricing");
      return () => clearTimeout(timeoutId);
    } else if (dayPass === "true") {
      // Trigger day pass checkout
      const timeoutId = setTimeout(() => {
        handleDayPassCheckout(provider);
      }, 100);
      // Clean up URL
      window.history.replaceState({}, "", "/pricing");
      return () => clearTimeout(timeoutId);
    } else {
      const payg = params.get("payg");
      if (payg && ["document", "ai_query", "afcfta_report"].includes(payg)) {
        const timeoutId = setTimeout(() => {
          handlePayAsYouGoCheckout(payg as "document" | "ai_query" | "afcfta_report", provider);
        }, 100);
        window.history.replaceState({}, "", "/pricing");
        return () => clearTimeout(timeoutId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  return (
    <div className="min-h-screen bg-background">
      {alertDialog}
      {/* Hero Section */}
      <section className={prototypeNavyHeroSectionClass}>
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundImage: PROTOTYPE_HERO_GRID_PATTERN }}
          aria-hidden
        />
        <div className="relative z-[1] mx-auto max-w-[760px] px-6 py-16 text-center sm:py-20">
          <p className={`mx-auto mb-6 ${prototypeHeroEyebrowClass}`}>Pricing</p>
          <h1 className="heading mb-4 text-4xl font-bold text-white sm:text-5xl">
            Free to read. Affordable to use.
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-[17px] text-white/[0.65]">
            Pay with mobile money or credit card. Invoice-ready for institutions. Pay only for what you need.
          </p>

          <div className="mx-auto inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                !isAnnual ? "bg-[#C8922A] text-white" : "text-white/70 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                isAnnual ? "bg-[#C8922A] text-white" : "text-white/70 hover:text-white"
              }`}
            >
              Annual <span className="ml-1 text-[11px] opacity-90">Save 17%</span>
            </button>
          </div>
          <p className="mx-auto mt-6 max-w-xl text-[15px] text-white/[0.75]">
            Choose a plan below, then complete billing and payment on the subscription checkout page.
          </p>
        </div>
      </section>

      {/* Subscription Plans */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="mb-10 rounded-[10px] border-l-4 border-[#C8922A] bg-muted px-6 py-5">
          <p className="flex items-start gap-3">
            <span className="text-3xl leading-none text-[#C8922A]">&ldquo;</span>
            <span className="heading text-2xl text-foreground">Everything you need to do business in Africa — in one place.</span>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {tiers.map((tier) => {
            const price =
              tier.priceMonthly === 0
                ? 0
                : isAnnual
                  ? tier.priceAnnualPerMonth
                  : tier.priceMonthly;
            const period = tier.priceMonthly === 0 ? "/forever" : "/month";
            const annualNote =
              tier.priceMonthly > 0 && isAnnual
                ? `billed annually as $${tier.priceAnnualTotal}/year (save $${tier.priceMonthly * 12 - tier.priceAnnualTotal})`
                : tier.subtitle || null;

            return (
              <div
                key={tier.id}
                className={`group relative flex flex-col rounded-[10px] border transition-all duration-300 hover:-translate-y-1 ${
                  tier.highlighted
                    ? "border-[#0D1B2A] bg-[#0D1B2A] text-white shadow-xl"
                    : "border-border bg-card shadow-sm"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#C8922A] px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg">
                    Most Popular
                  </div>
                )}
                <div className="p-6 sm:p-7 flex-1 flex flex-col">
                  <h3 className={`heading text-xl font-bold mb-2 sm:text-2xl ${tier.highlighted ? "text-white" : "text-foreground"}`}>
                    {tier.name}
                  </h3>
                  <div className="mb-4">
                    <span
                      className={`text-4xl font-bold sm:text-5xl ${tier.highlighted ? "text-[#E8B84B]" : "text-foreground"}`}
                    >
                      ${price}
                    </span>
                    <span className={`${tier.highlighted ? "text-white/65" : "text-muted-foreground"} ml-1`}>{period}</span>
                  </div>
                  {tier.description && (
                    <p className={`${tier.highlighted ? "text-white/65" : "text-muted-foreground"} mb-3 text-sm`}>{tier.description}</p>
                  )}
                  {annualNote && (
                    <p className={`text-xs mb-4 font-medium ${tier.highlighted ? "text-white/70" : "text-primary/90"}`}>
                      {annualNote}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => goToSubscriptionCheckout(tier.id)}
                    disabled={checkoutLoading !== null}
                    className={`w-full py-3 px-6 rounded-[6px] font-semibold transition-all duration-200 mt-auto disabled:opacity-70 ${
                      tier.highlighted
                        ? "bg-[#C8922A] text-white hover:bg-[#b07e22]"
                        : "border border-border bg-background text-foreground hover:border-[#d8c5a1]"
                    }`}
                  >
                    {checkoutLoading === tier.id ? "Redirecting…" : tier.cta}
                  </button>
                </div>

                <div className={`px-6 sm:px-7 pb-6 sm:pb-7 border-t ${tier.highlighted ? "border-white/10" : "border-border/70"}`}>
                  <div className={`text-sm font-semibold mb-4 mt-5 ${tier.highlighted ? "text-white/70" : "text-muted-foreground"}`}>
                    What is included:
                  </div>
                  <ul className="space-y-2.5 text-sm">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className={`h-5 w-5 shrink-0 mt-0.5 ${tier.highlighted ? "text-[#E8B84B]" : "text-primary"}`} strokeWidth={3} />
                        <span
                          dangerouslySetInnerHTML={{ __html: feature }}
                          className={`leading-relaxed ${tier.highlighted ? "text-white/90" : "text-foreground"}`}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Institutional CTA */}
        <div className="mt-8 rounded-[10px] border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="heading text-xl font-bold mb-2 text-foreground sm:text-2xl">
                Institutional Plans
              </h3>
              <p className="text-muted-foreground mb-2">
                For universities, governments, and large organizations
              </p>
              <p className="text-sm text-[#C8922A] font-medium">
                Starting at $1,000/year • Unlimited users • Custom training
              </p>
            </div>
            <button
              type="button"
              className="whitespace-nowrap rounded-[6px] bg-[#0D1B2A] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#162436] sm:px-8 sm:py-4 sm:text-lg"
            >
              Contact Sales
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[14px] border border-border bg-card px-7 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[170px_1fr_1fr_1fr] md:items-start md:gap-5">
            <div className="pt-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Payment Methods</div>
            <div>
              <div className="text-[18px] font-semibold leading-tight text-foreground">Mobile Money</div>
              <div className="mt-1 text-[14px] text-muted-foreground">M-Pesa · Orange Money · MTN · Airtel · Wave</div>
            </div>
            <div>
              <div className="text-[18px] font-semibold leading-tight text-foreground">Credit / debit card</div>
              <div className="mt-1 text-[14px] text-muted-foreground">Visa · Mastercard</div>
            </div>
            <div>
              <div className="text-[18px] font-semibold leading-tight text-foreground">Bank transfer</div>
              <div className="mt-1 text-[14px] text-muted-foreground">Invoice-ready for institutions</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pay-as-You-Go Section */}
      <section className="border-t border-border bg-background py-14 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <p className={prototypeHeroEyebrowClass}>Pay-as-you-go</p>
            <h2 className="heading mt-2 text-2xl font-bold text-foreground sm:text-3xl">Add what you need, when you need it.</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-[15px]">
              No subscription? No problem. Use these on the Free tier - or top up any plan.
            </p>
          </div>

          <div className="mx-auto mb-8 max-w-2xl rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Pay-as-you-go payment method</p>
            <p className="mt-1 text-xs text-muted-foreground">Used for one-off purchases below (not for subscription plans).</p>
            <div className="mt-4">
              <PaymentMethodPicker
                value={paymentProvider}
                onChange={setPaymentProvider}
                lomiAvailable={lomiAvailable}
              />
            </div>
            {paymentProvider === "pawapay" && (
              <div className="mt-4">
                <PawapayCountrySelect
                  id="pricing-pawapay-country"
                  label="Mobile money country"
                  value={pawapayPaymentCountry}
                  onChange={setPawapayPaymentCountry}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => handlePayAsYouGoCheckout("document")}
              disabled={checkoutLoading !== null}
              className="flex min-h-[132px] w-full items-center justify-between rounded-[14px] border border-border bg-card px-6 py-5 text-left transition hover:border-[#C8922A] hover:shadow-sm disabled:opacity-70"
            >
              <div className="pr-4 sm:pr-6">
                <div className="text-xl font-semibold leading-tight text-foreground sm:text-[28px]">Print a law</div>
                <div className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                  Download a full law as a clean, print-ready PDF - including amendments and metadata.
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-3xl font-bold leading-none text-[#C8922A] sm:text-[40px]">$3</div>
                <div className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">per law</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleDayPassCheckout()}
              disabled={checkoutLoading !== null}
              className="flex min-h-[132px] w-full items-center justify-between rounded-[14px] border border-border bg-card px-6 py-5 text-left transition hover:border-[#C8922A] hover:shadow-sm disabled:opacity-70"
            >
              <div className="pr-4 sm:pr-6">
                <div className="text-xl font-semibold leading-tight text-foreground sm:text-[28px]">Daily pass</div>
                <div className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                  Full platform access for 24 hours with expanded usage across the platform.
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-3xl font-bold leading-none text-[#C8922A] sm:text-[40px]">$9.99</div>
                <div className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">per day</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handlePayAsYouGoCheckout("afcfta_report")}
              disabled={checkoutLoading !== null}
              className="flex min-h-[132px] w-full items-center justify-between rounded-[14px] border border-border bg-card px-6 py-5 text-left transition hover:border-[#C8922A] hover:shadow-sm disabled:opacity-70"
            >
              <div className="pr-4 sm:pr-6">
                <div className="text-xl font-semibold leading-tight text-foreground sm:text-[28px]">Additional AfCFTA Passport route</div>
                <div className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                  One origin-to-destination country pair with checklist, rules of origin, and tariff data.
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-3xl font-bold leading-none text-[#C8922A] sm:text-[40px]">$15</div>
                <div className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">per route</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handlePayAsYouGoCheckout("ai_query")}
              disabled={checkoutLoading !== null}
              className="flex min-h-[132px] w-full items-center justify-between rounded-[14px] border border-border bg-card px-6 py-5 text-left transition hover:border-[#C8922A] hover:shadow-sm disabled:opacity-70"
            >
              <div className="pr-4 sm:pr-6">
                <div className="text-xl font-semibold leading-tight text-foreground sm:text-[28px]">AI research query pack</div>
                <div className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                  Additional AI research query with citations back to the Yamalé Legal Library.
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-3xl font-bold leading-none text-[#C8922A] sm:text-[40px]">$1</div>
                <div className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">per query</div>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-background py-14 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="heading mb-8 text-3xl font-bold text-foreground sm:text-4xl">
            Frequently asked
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                className="rounded-[8px] border border-border bg-card p-5 shadow-sm transition hover:shadow-md sm:p-6"
              >
                <h3 className="font-bold text-base mb-2 text-muted-foreground sm:text-lg">
                  {item.q}
                </h3>
                <p className="text-sm text-foreground sm:text-base">{item.a}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-[8px] border border-border bg-muted px-5 py-4 text-[13px] leading-relaxed text-muted-foreground">
            Prices shown are in USD. Subscriptions renew automatically unless canceled. Yamalé Alliance reserves the
            right to modify pricing with notice. The platform is provided as-is and does not constitute legal advice.
          </div>
        </div>
      </section>
    </div>
  );
}
