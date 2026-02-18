"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

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
      "Browse marketplace",
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
      "Browse marketplace",
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
      "Browse marketplace",
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
      "Browse marketplace",
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

function ToggleSwitch({
  value,
  onChange,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
}) {
  const isAnnual = value === "annual";
  return (
    <div
      className={`relative w-[64px] h-[34px] rounded-full cursor-pointer transition-all duration-300 shadow-lg ${
        isAnnual
          ? "bg-gradient-to-r from-[#9a632a] to-[#c18c43]"
          : "bg-gray-300 dark:bg-gray-600"
      }`}
      onClick={() => onChange(isAnnual ? "monthly" : "annual")}
    >
      <div
        className={`absolute top-[3px] left-[3px] h-7 w-7 bg-white rounded-full transition-transform duration-300 shadow-md ${
          isAnnual ? "translate-x-[30px]" : ""
        }`}
      />
    </div>
  );
}

export default function PricingPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [billing, setBilling] = useState<BillingInterval>("annual");
  const [tiers, setTiers] = useState<Tier[]>(FALLBACK_TIERS);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const isAnnual = billing === "annual";

  const handleCheckout = async (planId: string) => {
    if (planId === "free") return;
    
    // Check if user is signed in
    if (!isLoaded) return; // Wait for auth to load
    if (!isSignedIn) {
      // Redirect to sign-in with return URL
      const returnUrl = encodeURIComponent(`/pricing?plan=${planId}&interval=${billing}`);
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    setCheckoutLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId, interval: billing }),
      });
      const data = await res.json();
      if (!res.ok) {
        // If 401, redirect to sign-in
        if (res.status === 401) {
          const returnUrl = encodeURIComponent(`/pricing?plan=${planId}&interval=${billing}`);
          router.push(`/sign-in?redirect_url=${returnUrl}`);
          return;
        }
        alert(data.error || "Checkout failed");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setCheckoutLoading(null);
    }
  };
  
  const handleDayPassCheckout = async () => {
    // Check if user is signed in
    if (!isLoaded) return; // Wait for auth to load
    if (!isSignedIn) {
      // Redirect to sign-in with return URL
      const returnUrl = encodeURIComponent("/pricing?day_pass=true");
      router.push(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    setCheckoutLoading("day-pass");
    try {
      const res = await fetch("/api/stripe/day-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        // If 401, redirect to sign-in
        if (res.status === 401) {
          const returnUrl = encodeURIComponent("/pricing?day_pass=true");
          router.push(`/sign-in?redirect_url=${returnUrl}`);
          return;
        }
        alert(data.error || "Checkout failed");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Something went wrong. Please try again.");
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

    if (plan && ["basic", "pro", "team"].includes(plan)) {
      // Set billing interval if specified
      if (interval === "monthly" || interval === "annual") {
        setBilling(interval);
      }
      // Trigger checkout after a brief delay to ensure state is set
      const timeoutId = setTimeout(() => {
        handleCheckout(plan);
      }, 100);
      // Clean up URL
      window.history.replaceState({}, "", "/pricing");
      return () => clearTimeout(timeoutId);
    } else if (dayPass === "true") {
      // Trigger day pass checkout
      const timeoutId = setTimeout(() => {
        handleDayPassCheckout();
      }, 100);
      // Clean up URL
      window.history.replaceState({}, "", "/pricing");
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-[#221913] via-[#603b1c] to-[#221913]">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full opacity-[0.25] blur-[120px]"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-40 right-[-10%] h-96 w-96 rounded-full opacity-[0.2] blur-[100px]"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
        />
        <div className="relative max-w-6xl mx-auto px-6 py-20 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-[rgba(227,186,101,0.3)] bg-[rgba(227,186,101,0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#e3ba65] backdrop-blur mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e3ba65]" />
            Flexible pricing for everyone
          </p>
          <h1 className="heading text-4xl font-bold mb-4 text-white sm:text-5xl lg:text-6xl">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg mb-10 text-white/90 sm:text-xl">
            Choose your plan and pay as you go for extras
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span
              className={`text-base font-semibold transition-all sm:text-lg ${
                !isAnnual ? "opacity-100 scale-105" : "opacity-70"
              }`}
              style={{ color: !isAnnual ? "#e3ba65" : "rgba(255,255,255,0.8)" }}
            >
              Monthly
            </span>
            <ToggleSwitch value={billing} onChange={setBilling} />
            <div className="flex items-center gap-2">
              <span
                className={`text-base font-semibold transition-all sm:text-lg ${
                  isAnnual ? "opacity-100 scale-105" : "opacity-70"
                }`}
                style={{ color: isAnnual ? "#e3ba65" : "rgba(255,255,255,0.8)" }}
              >
                Annual
              </span>
              <span className="rounded-full border border-[rgba(227,186,101,0.4)] bg-[rgba(227,186,101,0.15)] px-3 py-1 text-[11px] font-bold text-[#e3ba65] backdrop-blur shadow-sm">
                Save 17%
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Subscription Plans */}
      <section className="max-w-7xl mx-auto px-4 -mt-10 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border/70 bg-card/95 shadow-lg shadow-primary/10 backdrop-blur-xl px-6 py-8 text-center mb-10">
          <h2 className="heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Subscription Plans
          </h2>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Full access to the platform with included usage
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
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
                className={`group relative flex flex-col rounded-2xl border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  tier.highlighted
                    ? "border-primary/60 bg-card/95 shadow-lg shadow-primary/20 ring-2 ring-primary/10 pt-6"
                    : "border-border/70 bg-card/95 shadow-md backdrop-blur-sm"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-full border border-primary/40 bg-gradient-to-r from-[rgba(96,59,28,0.95)] to-[rgba(154,99,42,0.95)] px-5 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg">
                    Most Popular
                  </div>
                )}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[rgba(193,140,67,0.9)] via-[rgba(227,186,101,0.95)] to-[rgba(154,99,42,0.9)] opacity-70" />

                <div className="p-6 sm:p-8 flex-1 flex flex-col pt-8">
                  <h3 className="heading text-xl font-bold mb-3 text-foreground sm:text-2xl">
                    {tier.name}
                  </h3>
                  <div className="mb-4">
                    <span
                      className={`text-4xl font-bold sm:text-5xl ${
                        tier.highlighted ? "text-primary" : "text-foreground"
                      }`}
                    >
                      ${price}
                    </span>
                    <span className="text-muted-foreground ml-1">{period}</span>
                  </div>
                  {tier.description && (
                    <p className="text-muted-foreground mb-3 text-sm">{tier.description}</p>
                  )}
                  {annualNote && (
                    <p className="text-xs mb-4 text-primary/90 font-medium">
                      {annualNote}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCheckout(tier.id)}
                    disabled={checkoutLoading !== null}
                    className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 mt-auto disabled:opacity-70 ${
                      tier.highlighted
                        ? "bg-gradient-to-r from-[rgba(154,99,42,0.95)] to-[rgba(193,140,67,0.95)] text-primary-foreground shadow-md shadow-primary/30 hover:brightness-105"
                        : "border-2 border-primary/60 bg-primary/10 text-foreground hover:border-primary hover:bg-primary/20 hover:shadow-md"
                    }`}
                  >
                    {checkoutLoading === tier.id ? "Redirecting…" : tier.cta}
                  </button>
                </div>

                <div className="px-6 sm:px-8 pb-6 sm:pb-8 border-t border-border/70">
                  <div className="text-sm font-semibold mb-4 mt-6 text-muted-foreground">
                    What's included:
                  </div>
                  <ul className="space-y-2.5 text-sm">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="h-5 w-5 shrink-0 text-primary mt-0.5" strokeWidth={3} />
                        <span
                          dangerouslySetInnerHTML={{ __html: feature }}
                          className="text-foreground leading-relaxed"
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
        <div className="mt-8 rounded-2xl border border-border/70 bg-card/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="heading text-xl font-bold mb-2 text-foreground sm:text-2xl">
                Institutional Plans
              </h3>
              <p className="text-muted-foreground mb-2">
                For universities, governments, and large organizations
              </p>
              <p className="text-sm text-primary/90 font-medium">
                Starting at $1,000/year • Unlimited users • Custom training
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl border border-primary/40 bg-gradient-to-r from-[rgba(96,59,28,0.95)] to-[rgba(154,99,42,0.95)] px-6 py-3 font-semibold text-sm text-primary-foreground shadow-md shadow-primary/30 transition hover:brightness-105 whitespace-nowrap sm:px-8 sm:py-4 sm:text-lg"
            >
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* Pay-as-You-Go Section */}
      <section className="border-t border-border/40 bg-gradient-to-b from-muted/20 via-background to-background py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="heading text-3xl font-bold mb-4 text-foreground sm:text-4xl">
              Pay-as-You-Go Pricing
            </h2>
            <p className="text-base text-muted-foreground sm:text-xl">
              One simple price for everyone. Buy exactly what you need, when you need it.
            </p>
          </div>

          {/* Flat Pay-as-You-Go Pricing */}
          <div className="mb-12">
            <div className="rounded-2xl border border-border/70 bg-card/95 p-6 shadow-lg shadow-primary/10 backdrop-blur-xl sm:p-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="group relative overflow-hidden rounded-xl border border-border/70 bg-background/80 p-6 text-center transition hover:border-primary/50 hover:shadow-md">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[rgba(193,140,67,0.9)] via-[rgba(227,186,101,0.95)] to-[rgba(154,99,42,0.9)] opacity-70" />
                  <div className="text-4xl mb-3 sm:text-5xl">📄</div>
                  <div className="text-lg font-bold mb-2 text-foreground sm:text-xl">
                    Documents
                  </div>
                  <div className="text-4xl font-bold mb-2 text-primary sm:text-5xl">
                    $3
                  </div>
                  <div className="text-sm text-muted-foreground">per document</div>
                  <div className="text-xs text-muted-foreground/80 mt-2">
                    Download & keep forever
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/70 bg-background/80 p-6 text-center transition hover:border-primary/50 hover:shadow-md">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[rgba(193,140,67,0.9)] via-[rgba(227,186,101,0.95)] to-[rgba(154,99,42,0.9)] opacity-70" />
                  <div className="text-4xl mb-3 sm:text-5xl">🤖</div>
                  <div className="text-lg font-bold mb-2 text-foreground sm:text-xl">
                    AI Queries
                  </div>
                  <div className="text-4xl font-bold mb-2 text-primary sm:text-5xl">
                    $1
                  </div>
                  <div className="text-sm text-muted-foreground">per query</div>
                  <div className="text-xs text-muted-foreground/80 mt-2">
                    Full answer with citations
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/70 bg-background/80 p-6 text-center transition hover:border-primary/50 hover:shadow-md">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[rgba(193,140,67,0.9)] via-[rgba(227,186,101,0.95)] to-[rgba(154,99,42,0.9)] opacity-70" />
                  <div className="text-4xl mb-3 sm:text-5xl">🔍</div>
                  <div className="text-lg font-bold mb-2 text-foreground sm:text-xl">
                    Lawyer Directory Search
                  </div>
                  <div className="text-4xl font-bold mb-2 text-primary sm:text-5xl">
                    $5
                  </div>
                  <div className="text-sm text-muted-foreground">per search</div>
                  <div className="text-xs text-muted-foreground/80 mt-2">
                    Unlocks direct email &amp; phone for matching lawyers
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/70 bg-background/80 p-6 text-center transition hover:border-primary/50 hover:shadow-md">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[rgba(193,140,67,0.9)] via-[rgba(227,186,101,0.95)] to-[rgba(154,99,42,0.9)] opacity-70" />
                  <div className="text-4xl mb-3 sm:text-5xl">📊</div>
                  <div className="text-lg font-bold mb-2 text-foreground sm:text-xl">
                    AfCFTA Reports
                  </div>
                  <div className="text-4xl font-bold mb-2 text-primary sm:text-5xl">
                    $15
                  </div>
                  <div className="text-sm text-muted-foreground">per report</div>
                  <div className="text-xs text-muted-foreground/80 mt-2">
                    Full compliance analysis
                  </div>
                </div>
              </div>

              <div className="mt-8 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm text-muted-foreground">
                <p>
                  💡 <strong className="text-foreground">Tip:</strong> Subscribers get these items included
                  in their monthly allowance. When you exceed your included amount, pay-as-you-go kicks in automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Day Pass */}
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-[#221913] via-[#603b1c] to-[#9a632a] p-8 text-center shadow-xl sm:p-10">
            <div
              className="pointer-events-none absolute -top-20 right-[-10%] h-64 w-64 rounded-full opacity-20 blur-3xl"
              style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
            />
            <div className="relative">
              <h3 className="heading text-2xl font-bold mb-4 text-white sm:text-3xl">
                24-Hour Day Pass
              </h3>
              <div className="text-4xl font-bold mb-4 text-[#e3ba65] sm:text-5xl">
                $9.99
              </div>
              <p className="text-base mb-6 max-w-2xl mx-auto text-[#e3ba65]/95 sm:text-xl">
                Get full Pro-level access for 24 hours including 20 AI queries, 10 downloads, and 2 reports
              </p>
              <button
                type="button"
                onClick={handleDayPassCheckout}
                disabled={checkoutLoading !== null}
                className="rounded-xl border border-white/20 bg-white px-6 py-3 font-bold text-sm text-[#603b1c] shadow-xl transition hover:bg-white/95 hover:shadow-2xl disabled:opacity-70 sm:px-8 sm:py-4 sm:text-lg"
              >
                {checkoutLoading === "day-pass" ? "Redirecting…" : "Get Day Pass"}
              </button>
              <p className="text-xs mt-4 text-[#e3ba65]/90 sm:text-sm">
                Perfect for one-time research or testing the platform
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/40 bg-gradient-to-b from-background via-muted/10 to-background py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="heading text-3xl font-bold text-center mb-12 text-foreground sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/70 bg-card/95 p-5 shadow-sm backdrop-blur-sm transition hover:border-primary/50 hover:shadow-md sm:p-6"
              >
                <h3 className="font-bold text-base mb-2 text-muted-foreground sm:text-lg">
                  {item.q}
                </h3>
                <p className="text-sm text-foreground sm:text-base">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
