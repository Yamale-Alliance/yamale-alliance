"use client";

import { useState } from "react";
import {
  FileText,
  CheckSquare,
  Square,
  Calculator,
  BookOpen,
  ArrowRight,
} from "lucide-react";

const AFCFTA_COUNTRIES = [
  "Ghana",
  "Nigeria",
  "Kenya",
  "South Africa",
  "Senegal",
  "Tanzania",
  "Rwanda",
  "Côte d'Ivoire",
  "Egypt",
  "Ethiopia",
  "Cameroon",
  "Morocco",
];

const SECTORS = [
  "Agriculture & Agro-processing",
  "Manufacturing",
  "Services (Professional)",
  "Transport & Logistics",
  "Digital Trade",
  "Financial Services",
];

const SECTOR_CHECKLISTS: Record<string, string[]> = {
  "Agriculture & Agro-processing": [
    "Sanitary and phytosanitary (SPS) certificate obtained",
    "Certificate of origin (AfCFTA template) completed",
    "Import permit from destination country (if required)",
    "Customs declaration filed",
    "Tariff classification verified under AfCFTA schedule",
    "Rules of origin criteria met (e.g. value-added threshold)",
    "Packaging and labelling meet destination standards",
  ],
  Manufacturing: [
    "Certificate of origin (AfCFTA) with product-specific rules",
    "Bill of materials / sourcing documentation for origin",
    "Customs declaration and HS code confirmed",
    "Technical standards compliance (destination market)",
    "Export license (if applicable in country of origin)",
    "Commercial invoice and packing list",
  ],
  "Services (Professional)": [
    "Professional qualification recognised in destination country",
    "Temporary licensing or registration (if required)",
    "Proof of establishment in home country",
    "Service contract or engagement letter",
    "Tax registration in host country (if applicable)",
  ],
  "Transport & Logistics": [
    "Carrier license / operator permit (cross-border)",
    "Cargo manifest and waybill",
    "Certificate of origin for goods carried",
    "Transit documentation (e.g. TIR, customs transit)",
    "Insurance certificate for cargo",
  ],
  "Digital Trade": [
    "Data protection / privacy compliance (destination rules)",
    "E-signature and e-contract validity confirmed",
    "Payment and consumer protection requirements met",
    "No localisation requirement violated",
  ],
  "Financial Services": [
    "Regulatory approval or notification in destination",
    "Capital and prudential requirements met",
    "Anti-money laundering (AML) documentation",
    "Client due diligence records",
  ],
};

const PRODUCT_CATEGORIES = [
  "Agricultural products (unprocessed)",
  "Processed foods",
  "Textiles and garments",
  "Chemicals",
  "Machinery and equipment",
  "Electronics",
  "Automobiles and parts",
];

const AFCFTA_DOCUMENTS = [
  { title: "AfCFTA Agreement (Consolidated Text)", type: "Agreement", year: "2018" },
  { title: "Protocol on Trade in Goods", type: "Protocol", year: "2018" },
  { title: "Protocol on Rules of Origin", type: "Protocol", year: "2018" },
  { title: "Tariff Schedules (Phase I)", type: "Schedule", year: "2022" },
  { title: "Guidelines on Certificate of Origin", type: "Guideline", year: "2022" },
  { title: "Protocol on Trade in Services", type: "Protocol", year: "2018" },
  { title: "Annex on Professional Services", type: "Annex", year: "2022" },
  { title: "Dispute Settlement Mechanism", type: "Procedure", year: "2020" },
];

const MOCK_COMPARISON_FIELDS = [
  "Tariff rate (preferential)",
  "Certificate of origin required",
  "SPS / standards approval",
  "Import license",
  "Customs clearance time (est.)",
];

function getMockComparisonValue(country: string, field: string): string {
  const seed = country.length + field.length;
  if (field.includes("Tariff")) return seed % 3 === 0 ? "0%" : `${(seed % 5) + 1}%`;
  if (field.includes("Certificate")) return "Yes";
  if (field.includes("SPS")) return seed % 2 === 0 ? "Mutual recognition" : "National approval";
  if (field.includes("license")) return seed % 2 === 0 ? "No" : "Yes (sector-specific)";
  if (field.includes("time")) return `${(seed % 3) + 1}-${(seed % 5) + 3} days`;
  return "—";
}

function getMockOriginResult(
  _product: string,
  origin: string,
  destination: string
): { eligible: boolean; note: string } {
  if (origin === destination) {
    return { eligible: false, note: "Origin and destination must be different." };
  }
  const eligible = origin.length % 2 === destination.length % 2;
  return {
    eligible,
    note: eligible
      ? "Based on current AfCFTA rules, this product may qualify for preferential treatment. Verify product-specific rules and value-added requirements."
      : "Verify product-specific rules of origin and value-added thresholds for your HS code.",
  };
}

export default function AfCFTAPage() {
  const [countryA, setCountryA] = useState("");
  const [countryB, setCountryB] = useState("");
  const [sector, setSector] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [destCountry, setDestCountry] = useState("");
  const [checklistProgress, setChecklistProgress] = useState<Record<string, boolean>>({});

  const toggleChecklistItem = (key: string) => {
    setChecklistProgress((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const originResult =
    originCountry && destCountry && productCategory
      ? getMockOriginResult(productCategory, originCountry, destCountry)
      : null;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="border-b border-border bg-card/50 px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            AfCFTA Compliance Passport
          </h1>
          <p className="mt-2 text-muted-foreground">
            Cross-border compliance tools, sector checklists, rules of origin,
            and document library. Static tools — no AI.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
        {/* 1. Country comparison */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-5 w-5" />
            Country comparison tool
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare key requirements between two AfCFTA state parties.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Country A</label>
              <select
                value={countryA}
                onChange={(e) => setCountryA(e.target.value)}
                className="w-full min-w-[180px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select country</option>
                {AFCFTA_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-muted-foreground">
              <ArrowRight className="h-5 w-5" />
            </span>
            <div>
              <label className="mb-1 block text-sm font-medium">Country B</label>
              <select
                value={countryB}
                onChange={(e) => setCountryB(e.target.value)}
                className="w-full min-w-[180px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select country</option>
                {AFCFTA_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {countryA && countryB && (
            <div className="mt-6 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Requirement</th>
                    <th className="px-4 py-3 text-left font-medium">{countryA}</th>
                    <th className="px-4 py-3 text-left font-medium">{countryB}</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_COMPARISON_FIELDS.map((field) => (
                    <tr key={field} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{field}</td>
                      <td className="px-4 py-3">{getMockComparisonValue(countryA, field)}</td>
                      <td className="px-4 py-3">{getMockComparisonValue(countryB, field)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 2. Sector checklists */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CheckSquare className="h-5 w-5" />
            Sector checklists
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a sector to view compliance checklist (static reference).
          </p>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Sector</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full max-w-md rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select sector</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {sector && SECTOR_CHECKLISTS[sector] && (
            <ul className="mt-4 space-y-2">
              {SECTOR_CHECKLISTS[sector].map((item, i) => {
                const key = `${sector}-${i}`;
                const checked = checklistProgress[key];
                return (
                  <li key={key} className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleChecklistItem(key)}
                      className="mt-0.5 flex shrink-0 rounded border border-input p-0.5 focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label={checked ? "Uncheck" : "Check"}
                    >
                      {checked ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <span
                      className={`text-sm ${checked ? "text-muted-foreground line-through" : "text-foreground"}`}
                    >
                      {item}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 3. Rules of origin calculator */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Calculator className="h-5 w-5" />
            Rules of origin calculator
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check whether your product may qualify for AfCFTA preferential treatment (indicative only).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Product category</label>
              <select
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select category</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Country of origin</label>
              <select
                value={originCountry}
                onChange={(e) => setOriginCountry(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select country</option>
                {AFCFTA_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Destination country</label>
              <select
                value={destCountry}
                onChange={(e) => setDestCountry(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select country</option>
                {AFCFTA_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {originResult && (
            <div
              className={`mt-4 rounded-lg border p-4 ${
                originResult.eligible
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-amber-500/30 bg-amber-500/5"
              }`}
            >
              <p className="font-medium">
                {originResult.eligible
                  ? "May qualify for preferential treatment"
                  : "Verify rules of origin"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{originResult.note}</p>
            </div>
          )}
        </section>

        {/* 4. Document library */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5" />
            Document library
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Key AfCFTA agreements, protocols, and guidelines (references).
          </p>
          <ul className="mt-4 divide-y divide-border">
            {AFCFTA_DOCUMENTS.map((doc) => (
              <li
                key={doc.title}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"
              >
                <div>
                  <p className="font-medium text-foreground">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.type} · {doc.year}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
                >
                  View / Download
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
