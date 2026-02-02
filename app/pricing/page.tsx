"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type BillingInterval = "monthly" | "annual";

type TierId = "free" | "pro" | "plus";

type Tier = {
  id: TierId;
  name: string;
  priceMonthly: number;
  priceAnnualPerMonth: number;
  priceAnnualTotal: number;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceAnnualPerMonth: 0,
    priceAnnualTotal: 0,
    description: "Get started with core access.",
    features: [
      "5 AI research queries per month",
      "Library & AfCFTA tools",
      "Basic marketplace access",
      "Community support",
    ],
    cta: "Get started",
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 79,
    priceAnnualPerMonth: 65,
    priceAnnualTotal: 790,
    description: "For professionals and small teams.",
    features: [
      "50 AI research queries per month",
      "Everything in Free",
      "Priority support",
      "Export & reports",
      "Lawyer directory discounts",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    id: "plus",
    name: "Plus",
    priceMonthly: 199,
    priceAnnualPerMonth: 165,
    priceAnnualTotal: 1990,
    description: "Unlimited access for firms.",
    features: [
      "Unlimited AI research queries",
      "Everything in Pro",
      "Dedicated account manager",
      "API access",
      "Custom integrations",
      "Team seats (up to 10)",
    ],
    cta: "Contact sales",
  },
];

const FAQ_ITEMS = [
  {
    q: "Can I switch plans later?",
    a: "Yes. You can upgrade or downgrade at any time. When upgrading, we’ll prorate the difference. When downgrading, the new rate applies at the next billing cycle.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept major credit and debit cards (Visa, Mastercard), and in select regions, mobile money (MTN, Airtel, Orange) and bank transfer.",
  },
  {
    q: "Is there a free trial for Pro or Plus?",
    a: "Pro includes a 14-day free trial. Plus is available on request—contact our sales team for a demo and trial terms.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "Your data remains available for 90 days after cancellation. You can export it anytime. After 90 days it is deleted in line with our privacy policy.",
  },
  {
    q: "Do you offer discounts for nonprofits or education?",
    a: "Yes. We offer discounted rates for registered nonprofits and accredited educational institutions. Contact us with your details to apply.",
  },
];

function BillingToggle({
  value,
  onChange,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/50 p-1">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          value === "monthly"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          value === "annual"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Annual
        <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
          Save 17%
        </span>
      </button>
    </div>
  );
}

function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
              aria-expanded={isOpen}
            >
              {item.q}
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground bg-muted/30">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingInterval>("monthly");
  const isAnnual = billing === "annual";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-4 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Pricing
          </h1>
          <p className="mt-2 text-muted-foreground">
            Tiered access for individuals, teams, and institutions. Choose monthly or annual billing.
          </p>
          <div className="mt-8 flex justify-center">
            <BillingToggle value={billing} onChange={setBilling} />
          </div>
        </div>
      </div>

      {/* Tiers */}
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TIERS.map((tier) => {
            const price = tier.priceMonthly === 0
              ? 0
              : isAnnual
                ? tier.priceAnnualPerMonth
                : tier.priceMonthly;
            const isPaid = tier.priceMonthly > 0;
            const annualNote = isPaid && isAnnual ? ` (billed $${tier.priceAnnualTotal}/yr)` : null;

            return (
              <article
                key={tier.id}
                className={`flex flex-col rounded-2xl border bg-card p-6 transition-shadow hover:shadow-lg ${
                  tier.highlighted
                    ? "border-primary shadow-md ring-2 ring-primary/20"
                    : "border-border"
                }`}
              >
                {tier.highlighted && (
                  <span className="mb-4 inline-block w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    Popular
                  </span>
                )}
                <h2 className="text-xl font-semibold">{tier.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tier.description}
                </p>
                <div className="mt-6 flex flex-wrap items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">
                    ${price}
                  </span>
                  {isPaid && (
                    <span className="text-sm text-muted-foreground">
                      /mo{annualNote ?? ""}
                    </span>
                  )}
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((feature, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-muted-foreground"
                    >
                      <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    tier.highlighted
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-border bg-background hover:bg-accent"
                  }`}
                >
                  {tier.cta}
                </button>
              </article>
            );
          })}
        </div>

        {/* Feature comparison table (compact) */}
        <div className="mt-16">
          <h2 className="text-xl font-semibold">Feature comparison</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What’s included in each plan.
          </p>
          <div className="mt-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Feature</th>
                  <th className="px-4 py-3 text-center font-medium">Free</th>
                  <th className="px-4 py-3 text-center font-medium">Pro</th>
                  <th className="px-4 py-3 text-center font-medium">Plus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3 text-muted-foreground">AI research queries</td>
                  <td className="px-4 py-3 text-center">5 / month</td>
                  <td className="px-4 py-3 text-center">50 / month</td>
                  <td className="px-4 py-3 text-center">Unlimited</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-muted-foreground">Library & AfCFTA</td>
                  <td className="px-4 py-3 text-center">✓</td>
                  <td className="px-4 py-3 text-center">✓</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-muted-foreground">Priority support</td>
                  <td className="px-4 py-3 text-center">—</td>
                  <td className="px-4 py-3 text-center">✓</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-muted-foreground">Export & reports</td>
                  <td className="px-4 py-3 text-center">—</td>
                  <td className="px-4 py-3 text-center">✓</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-muted-foreground">API access</td>
                  <td className="px-4 py-3 text-center">—</td>
                  <td className="px-4 py-3 text-center">—</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-muted-foreground">Team seats</td>
                  <td className="px-4 py-3 text-center">1</td>
                  <td className="px-4 py-3 text-center">1</td>
                  <td className="px-4 py-3 text-center">Up to 10</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <h2 className="text-xl font-semibold">Frequently asked questions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Billing, trials, and plan changes.
          </p>
          <div className="mt-6 max-w-2xl">
            <FAQAccordion />
          </div>
        </div>
      </div>
    </div>
  );
}
