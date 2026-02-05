"use client";

import { useState } from "react";
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

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceAnnualPerMonth: 0,
    priceAnnualTotal: 0,
    description: "Explore and browse African law",
    features: [
      "Unlimited browsing",
      "View document summaries",
      "Save up to 10 documents",
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
    description: "For students & professionals",
    subtitle: "or $50/year (save $10)",
    features: [
      "<strong>Read full documents</strong> online",
      "<strong>5 document downloads/month</strong>",
      "<strong>10 AI queries/month</strong>",
      "<strong>1 AfCFTA report/month</strong>",
      "Unlimited saved documents",
    ],
    cta: "Start 10-Day Trial",
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 15,
    priceAnnualPerMonth: 12,
    priceAnnualTotal: 150,
    description: "For active professionals",
    subtitle: "or $150/year (save $30)",
    features: [
      "<strong>20 document downloads/month</strong>",
      "<strong>50 AI queries/month</strong>",
      "<strong>5 AfCFTA reports/month</strong>",
      "<strong>3 lawyer contacts/month</strong>",
      "Share documents via email",
      "Download AI conversations",
    ],
    cta: "Start 10-Day Trial",
  },
  {
    id: "team",
    name: "Team",
    priceMonthly: 40,
    priceAnnualPerMonth: 33,
    priceAnnualTotal: 400,
    description: "For firms & organizations",
    subtitle: "or $400/year (save $80)",
    features: [
      "<strong>5 user seats included</strong>",
      "<strong>250 downloads/month</strong> (50/user)",
      "<strong>Unlimited AI queries</strong>",
      "<strong>Unlimited AfCFTA reports</strong>",
      "<strong>10 lawyer contacts/month</strong>",
      "Additional seats: $6/month each",
    ],
    cta: "Start 10-Day Trial",
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
    q: "Is there a free trial?",
    a: "Yes! All paid plans come with a 10-day free trial. No credit card required to start.",
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
      className={`relative w-[60px] h-[30px] rounded-[15px] cursor-pointer transition-colors ${
        isAnnual ? "bg-[#c18c43]" : "bg-gray-300"
      }`}
      onClick={() => onChange(isAnnual ? "monthly" : "annual")}
    >
      <div
        className={`absolute top-[3px] left-[3px] w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${
          isAnnual ? "translate-x-[30px]" : ""
        }`}
      />
    </div>
  );
}

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingInterval>("annual");
  const isAnnual = billing === "annual";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div
        className="text-white py-20"
        style={{
          background: "linear-gradient(135deg, #221913 0%, #603b1c 100%)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h1 className="heading text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl mb-8 opacity-90">
            Choose your plan and pay as you go for extras
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span
              className={`text-lg font-semibold transition-opacity ${
                !isAnnual ? "opacity-100" : "opacity-70"
              }`}
              style={{ color: !isAnnual ? "#e3ba65" : "white" }}
            >
              Monthly
            </span>
            <ToggleSwitch value={billing} onChange={setBilling} />
            <div className="flex items-center gap-2">
              <span
                className={`text-lg font-semibold transition-opacity ${
                  isAnnual ? "opacity-100" : "opacity-70"
                }`}
                style={{ color: isAnnual ? "#e3ba65" : "white" }}
              >
                Annual
              </span>
              <span
                className="text-white px-2 py-0.5 rounded text-[11px] font-semibold"
                style={{
                  background: "linear-gradient(135deg, #9a632a, #c18c43)",
                }}
              >
                Save 17%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Plans */}
      <div className="max-w-7xl mx-auto px-6 -mt-10 pb-12">
        <div className="bg-white rounded-2xl shadow-lg border border-[#e3ba65]/40 px-6 py-8 text-center mb-10">
          <h2
            className="heading text-4xl font-bold tracking-tight"
            style={{ color: "#221913" }}
          >
            Subscription Plans
          </h2>
          <p className="mt-3 text-lg" style={{ color: "#603b1c" }}>
            Full access to the platform with included usage
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          {TIERS.map((tier) => {
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
                className={`bg-white rounded-2xl shadow-lg border-2 relative transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl flex flex-col ${
                  tier.highlighted
                    ? "border-[#c18c43] shadow-xl ring-2 ring-[#c18c43]/20 pt-6"
                    : "border-[#e3ba65]/50"
                }`}
              >
                {tier.highlighted && (
                  <div
                    className="absolute -top-4 left-1/2 -translate-x-1/2 text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider shadow-lg z-10 whitespace-nowrap"
                    style={{
                      background: "linear-gradient(135deg, #603b1c, #9a632a)",
                    }}
                  >
                    Most Popular
                  </div>
                )}

                <div className="p-8 flex-1 flex flex-col">
                  <h3
                    className="heading text-2xl font-bold mb-3"
                    style={{ color: "#221913" }}
                  >
                    {tier.name}
                  </h3>
                  <div className="mb-4">
                    <span
                      className={`text-5xl font-bold ${
                        tier.highlighted ? "text-[#c18c43]" : "text-[#221913]"
                      }`}
                    >
                      ${price}
                    </span>
                    <span className="text-[#603b1c] ml-1">{period}</span>
                  </div>
                  <p className="text-[#603b1c] mb-3 text-sm">{tier.description}</p>
                  {annualNote && (
                    <p className="text-xs mb-4" style={{ color: "#9a632a" }}>
                      {annualNote}
                    </p>
                  )}
                  <button
                    type="button"
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 mt-auto ${
                      tier.highlighted
                        ? "text-white hover:opacity-90 shadow-md"
                        : "border-2 hover:shadow-md"
                    }`}
                    style={
                      tier.highlighted
                        ? {
                            background:
                              "linear-gradient(135deg, #9a632a, #c18c43)",
                          }
                        : {
                            borderColor: "#c18c43",
                            color: "#c18c43",
                            backgroundColor: "transparent",
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!tier.highlighted) {
                        e.currentTarget.style.backgroundColor = "rgba(193, 140, 67, 0.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!tier.highlighted) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    {tier.cta}
                  </button>
                </div>

                <div className="px-8 pb-8 border-t border-[#e3ba65]/30">
                  <div
                    className="text-sm font-semibold mb-4 mt-6"
                    style={{ color: "#603b1c" }}
                  >
                    {tier.id === "free"
                      ? "What's included:"
                      : `Everything in ${tier.id === "basic" ? "Free" : tier.id === "pro" ? "Basic" : "Pro"}, plus:`}
                  </div>
                  <ul className="space-y-3 text-sm">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="h-5 w-5 shrink-0 text-[#c18c43] mt-0.5" strokeWidth={3} />
                        <span
                          dangerouslySetInnerHTML={{ __html: feature }}
                          className="text-[#221913] leading-relaxed"
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
        <div className="mt-8 bg-white rounded-2xl p-8 shadow-lg border-2" style={{ borderColor: "#e3ba65" }}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3
                className="heading text-2xl font-bold mb-2"
                style={{ color: "#221913" }}
              >
                Institutional Plans
              </h3>
              <p className="text-[#603b1c] mb-2">
                For universities, governments, and large organizations
              </p>
              <p className="text-sm" style={{ color: "#9a632a" }}>
                Starting at $1,000/year • Unlimited users • Custom training
              </p>
            </div>
            <button
              type="button"
              className="px-8 py-4 rounded-lg font-bold text-lg whitespace-nowrap text-white hover:opacity-90 transition shadow-md"
              style={{
                background: "linear-gradient(135deg, #603b1c, #9a632a)",
              }}
            >
              Contact Sales
            </button>
          </div>
        </div>
      </div>

      {/* Pay-as-You-Go Section */}
      <div className="bg-gray-100 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2
              className="heading text-4xl font-bold mb-4"
              style={{ color: "#221913" }}
            >
              Pay-as-You-Go Pricing
            </h2>
          <p className="text-xl" style={{ color: "#603b1c" }}>
            One simple price for everyone. Buy exactly what you need, when you
            need it.
          </p>
          </div>

          {/* Flat Pay-as-You-Go Pricing */}
          <div className="mb-12">
            <div
              className="bg-white rounded-2xl p-10 shadow-lg border-2"
              style={{ borderColor: "#c18c43" }}
            >
              <div className="grid md:grid-cols-4 gap-8">
                <div className="text-center p-8 bg-gray-50 rounded-xl">
                  <div className="text-5xl mb-4">📄</div>
                  <div
                    className="text-xl font-bold mb-3"
                    style={{ color: "#221913" }}
                  >
                    Documents
                  </div>
                  <div
                    className="text-5xl font-bold mb-3"
                    style={{ color: "#c18c43" }}
                  >
                    $3
                  </div>
                  <div className="text-sm text-gray-600">per document</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Download & keep forever
                  </div>
                </div>

                <div className="text-center p-8 bg-gray-50 rounded-xl">
                  <div className="text-5xl mb-4">🤖</div>
                  <div
                    className="text-xl font-bold mb-3"
                    style={{ color: "#221913" }}
                  >
                    AI Queries
                  </div>
                  <div
                    className="text-5xl font-bold mb-3"
                    style={{ color: "#c18c43" }}
                  >
                    $1
                  </div>
                  <div className="text-sm" style={{ color: "#603b1c" }}>per query</div>
                  <div className="text-xs mt-2" style={{ color: "#9a632a" }}>
                    Full answer with citations
                  </div>
                </div>

                <div className="text-center p-8 bg-gray-50 rounded-xl">
                  <div className="text-5xl mb-4">👨‍⚖️</div>
                  <div
                    className="text-xl font-bold mb-3"
                    style={{ color: "#221913" }}
                  >
                    Lawyer Contacts
                  </div>
                  <div
                    className="text-5xl font-bold mb-3"
                    style={{ color: "#c18c43" }}
                  >
                    $5
                  </div>
                  <div className="text-sm" style={{ color: "#603b1c" }}>per contact</div>
                  <div className="text-xs mt-2" style={{ color: "#9a632a" }}>
                    Direct email & phone
                  </div>
                </div>

                <div className="text-center p-8 bg-gray-50 rounded-xl">
                  <div className="text-5xl mb-4">📊</div>
                  <div
                    className="text-xl font-bold mb-3"
                    style={{ color: "#221913" }}
                  >
                    AfCFTA Reports
                  </div>
                  <div
                    className="text-5xl font-bold mb-3"
                    style={{ color: "#c18c43" }}
                  >
                    $15
                  </div>
                  <div className="text-sm" style={{ color: "#603b1c" }}>per report</div>
                  <div className="text-xs mt-2" style={{ color: "#9a632a" }}>
                    Full compliance analysis
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center text-sm" style={{ color: "#603b1c" }}>
                <p>
                  💡 <strong>Tip:</strong> Subscribers get these items included
                  in their monthly allowance. When you exceed your included
                  amount, pay-as-you-go kicks in automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Day Pass */}
          <div
            className="rounded-2xl p-10 text-white text-center"
            style={{
              background: "linear-gradient(135deg, #221913 0%, #603b1c 50%, #9a632a 100%)",
            }}
          >
            <h3 className="heading text-3xl font-bold mb-4">
              24-Hour Day Pass
            </h3>
            <div className="text-5xl font-bold mb-4" style={{ color: "#e3ba65" }}>
              $9.99
            </div>
            <p className="text-xl mb-6 max-w-2xl mx-auto opacity-95" style={{ color: "#e3ba65" }}>
              Get full Pro-level access for 24 hours including 20 AI queries, 10
              downloads, and 2 reports
            </p>
            <button
              type="button"
              className="bg-white px-8 py-4 rounded-lg font-bold text-lg shadow-xl hover:shadow-2xl transition hover:opacity-90"
              style={{ color: "#603b1c" }}
            >
              Get Day Pass
            </button>
            <p className="text-sm mt-4 opacity-90" style={{ color: "#e3ba65" }}>
              Perfect for one-time research or testing the platform
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-gray-100 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2
            className="heading text-4xl font-bold text-center mb-12"
            style={{ color: "#221913" }}
          >
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow border border-[#e3ba65]/30">
                <h3
                  className="font-bold text-lg mb-2"
                  style={{ color: "#603b1c" }}
                >
                  {item.q}
                </h3>
                <p style={{ color: "#221913" }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
