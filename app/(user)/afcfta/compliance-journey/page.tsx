"use client";

import { useState } from "react";
import {
  FileText,
  CheckSquare,
  Square,
  Calculator,
  BookOpen,
  ArrowRight,
  Table,
  Search,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  Target,
  Shield,
  Award,
  Info,
} from "lucide-react";
import Link from "next/link";

const CONTINENTS = ["Africa", "Asia", "Europe", "Americas", "Oceania"];

const COUNTRIES_BY_CONTINENT: Record<string, string[]> = {
  Africa: [
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
    "Algeria",
    "Angola",
    "Benin",
    "Botswana",
    "Burkina Faso",
    "Burundi",
    "Cabo Verde",
    "Central African Republic",
    "Chad",
    "Comoros",
    "Congo",
    "Djibouti",
    "Equatorial Guinea",
    "Eritrea",
    "Eswatini",
    "Gabon",
    "Gambia",
    "Guinea",
    "Guinea-Bissau",
    "Lesotho",
    "Liberia",
    "Libya",
    "Madagascar",
    "Malawi",
    "Mali",
    "Mauritania",
    "Mauritius",
    "Mozambique",
    "Namibia",
    "Niger",
    "São Tomé and Príncipe",
    "Seychelles",
    "Sierra Leone",
    "Somalia",
    "South Sudan",
    "Sudan",
    "Togo",
    "Tunisia",
    "Uganda",
    "Zambia",
    "Zimbabwe",
  ],
  Asia: ["China", "India", "Japan", "South Korea", "Singapore", "UAE", "Saudi Arabia"],
  Europe: ["United Kingdom", "France", "Germany", "Italy", "Spain", "Netherlands"],
  Americas: ["United States", "Canada", "Brazil", "Mexico", "Argentina"],
  Oceania: ["Australia", "New Zealand"],
};

const AFCFTA_COUNTRIES = COUNTRIES_BY_CONTINENT.Africa;

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

type Step = "tariff" | "origin" | "compliance" | "documents";

const STEPS: Array<{ id: Step; label: string; icon: typeof Table }> = [
  { id: "tariff", label: "Tariff Lookup", icon: Table },
  { id: "origin", label: "Rules of Origin", icon: Calculator },
  { id: "compliance", label: "Compliance Checklist", icon: CheckSquare },
  { id: "documents", label: "Document Library", icon: FileText },
];

export default function ComplianceJourneyPage() {
  const [activeStep, setActiveStep] = useState<Step>("tariff");
  const [countryA, setCountryA] = useState("");
  const [countryB, setCountryB] = useState("");
  const [sector, setSector] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [destCountry, setDestCountry] = useState("");
  const [originContinent, setOriginContinent] = useState("");
  const [destContinent, setDestContinent] = useState("");
  const [destinationContinent, setDestinationContinent] = useState("");
  const [checklistProgress, setChecklistProgress] = useState<Record<string, boolean>>({});
  const [hsCode, setHsCode] = useState("");
  const [productValue, setProductValue] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");

  const getFilteredCountries = (continent: string) => {
    if (!continent) return [];
    return COUNTRIES_BY_CONTINENT[continent] || [];
  };

  const toggleChecklistItem = (key: string) => {
    setChecklistProgress((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getStepIndex = (step: Step) => STEPS.findIndex((s) => s.id === step);
  const currentStepIndex = getStepIndex(activeStep);
  const progressPercent = ((currentStepIndex + 1) / STEPS.length) * 100;

  const completedSteps = currentStepIndex;
  const checklistItems = sector ? SECTOR_CHECKLISTS[sector] || [] : [];
  const checklistCompleted = checklistItems.filter((_, i) => checklistProgress[`${sector}-${i}`]).length;
  const checklistTotal = checklistItems.length;
  const checklistPercent = checklistTotal > 0 ? (checklistCompleted / checklistTotal) * 100 : 0;

  // Mock calculations for demo
  const mockSavings = hsCode && productValue
    ? (parseFloat(productValue) * 0.15).toLocaleString("en-US", { style: "currency", currency: "USD" })
    : null;
  const mockTariffRate = hsCode ? "5.2%" : null;
  const mockAfCFTARate = hsCode ? "2.1%" : null;

  const originResult =
    originCountry && destCountry && productCategory
      ? {
          eligible: originCountry !== destCountry,
          note: originCountry !== destCountry
            ? "Based on current AfCFTA rules, this product may qualify for preferential treatment. Verify product-specific rules and value-added requirements."
            : "Origin and destination must be different.",
        }
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/20 via-background to-background">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-border bg-gradient-to-r from-[#1a1a1a] via-[#2d2d2d] to-[#1a1a1a] shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#c99d2e] text-[#1a1a1a] font-bold text-lg">
                🌍
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">AfCFTA Compliance Journey</h1>
                <p className="text-xs text-white/70">Step-by-step trade compliance guide</p>
              </div>
            </div>
            <Link
              href="/afcfta"
              className="text-sm text-white/80 hover:text-white transition-colors"
            >
              ← Back to Tools
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Progress Steps */}
        <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-lg">
          <div className="relative mb-6">
            <div className="absolute top-5 left-0 right-0 h-1 bg-muted" />
            <div
              className="absolute top-5 left-0 h-1 bg-gradient-to-r from-[#D4AF37] to-[#2d5016] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
            <div className="relative flex justify-between">
              {STEPS.map((step, idx) => {
                const StepIcon = step.icon;
                const isActive = activeStep === step.id;
                const isCompleted = idx < currentStepIndex;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className="flex flex-col items-center flex-1 group"
                  >
                    <div
                      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                        isCompleted
                          ? "border-[#D4AF37] bg-[#D4AF37] text-[#1a1a1a]"
                          : isActive
                          ? "border-[#2d5016] bg-[#2d5016] text-white scale-110"
                          : "border-muted bg-background text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-5 w-5" />
                      )}
                    </div>
                    <span
                      className={`mt-2 text-xs font-semibold text-center ${
                        isActive ? "text-[#2d5016]" : isCompleted ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* Step 1: Tariff Lookup */}
          {activeStep === "tariff" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-card p-6 shadow-md">
                <div className="mb-6 flex items-center gap-4 border-b border-border pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#c99d2e]">
                    <Table className="h-6 w-6 text-[#1a1a1a]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Tariff Schedule Lookup</h2>
                    <p className="text-sm text-muted-foreground">
                      Find tariff rates and potential savings for your products
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold">HS Code</label>
                      <input
                        type="text"
                        value={hsCode}
                        onChange={(e) => setHsCode(e.target.value)}
                        placeholder="e.g., 0101.21"
                        className="w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Product Value (USD)</label>
                      <input
                        type="number"
                        value={productValue}
                        onChange={(e) => setProductValue(e.target.value)}
                        placeholder="e.g., 10000"
                        className="w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Continent</label>
                      <select
                        value={destinationContinent}
                        onChange={(e) => {
                          setDestinationContinent(e.target.value);
                          setCountryB("");
                        }}
                        className="w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                      >
                        <option value="">Select continent</option>
                        {CONTINENTS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Destination Country</label>
                      <select
                        value={countryB}
                        onChange={(e) => setCountryB(e.target.value)}
                        disabled={!destinationContinent}
                        className="w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select country</option>
                        {getFilteredCountries(destinationContinent).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Link
                      href="/afcfta/tariff-schedule"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-6 py-3 font-semibold text-[#1a1a1a] transition-all hover:scale-[1.02] hover:shadow-lg"
                    >
                      <Search className="h-5 w-5" />
                      Open Full Tariff Schedule
                    </Link>
                  </div>

                  {hsCode && (
                    <div className="rounded-lg border border-border bg-gradient-to-br from-muted/50 to-background p-6">
                      <h3 className="mb-4 text-lg font-semibold">Estimated Savings</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                          <span className="text-sm text-muted-foreground">MFN Rate</span>
                          <span className="text-lg font-bold">{mockTariffRate || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-green-500/10 p-4">
                          <span className="text-sm text-green-700 dark:text-green-400">AfCFTA Rate</span>
                          <span className="text-lg font-bold text-green-700 dark:text-green-400">
                            {mockAfCFTARate || "—"}
                          </span>
                        </div>
                        {mockSavings && (
                          <div className="rounded-lg bg-gradient-to-r from-[#2d5016] to-[#3a6a1d] p-6 text-center text-white">
                            <div className="text-sm uppercase tracking-wider opacity-90">Potential Annual Savings</div>
                            <div className="mt-2 text-4xl font-bold">{mockSavings}</div>
                            <div className="mt-2 text-sm opacity-80">on $10,000 shipment</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Rules of Origin */}
          {activeStep === "origin" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-card p-6 shadow-md">
                <div className="mb-6 flex items-center gap-4 border-b border-border pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#c99d2e]">
                    <Calculator className="h-6 w-6 text-[#1a1a1a]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Rules of Origin Calculator</h2>
                    <p className="text-sm text-muted-foreground">
                      Check if your product qualifies for AfCFTA preferential treatment
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="mb-2 block text-sm font-semibold">Product Category</label>
                    <select
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                      className="w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                    >
                      <option value="">Select category</option>
                      {PRODUCT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold">Origin Continent</label>
                        <select
                          value={originContinent}
                          onChange={(e) => {
                            setOriginContinent(e.target.value);
                            setOriginCountry("");
                          }}
                          className="w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                        >
                          <option value="">Select continent</option>
                          {CONTINENTS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold">Country of Origin</label>
                        <select
                          value={originCountry}
                          onChange={(e) => setOriginCountry(e.target.value)}
                          disabled={!originContinent}
                          className="w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select country</option>
                          {getFilteredCountries(originContinent).map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold">Destination Continent</label>
                        <select
                          value={destContinent}
                          onChange={(e) => {
                            setDestContinent(e.target.value);
                            setDestCountry("");
                          }}
                          className="w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                        >
                          <option value="">Select continent</option>
                          {CONTINENTS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold">Destination Country</label>
                        <select
                          value={destCountry}
                          onChange={(e) => setDestCountry(e.target.value)}
                          disabled={!destContinent}
                          className="w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select country</option>
                          {getFilteredCountries(destContinent).map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {originResult && (
                  <div
                    className={`mt-6 rounded-lg border-l-4 p-4 ${
                      originResult.eligible
                        ? "border-green-500 bg-green-500/10"
                        : "border-amber-500 bg-amber-500/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {originResult.eligible ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      )}
                      <div>
                        <p className="font-semibold">
                          {originResult.eligible
                            ? "May qualify for preferential treatment"
                            : "Verify rules of origin"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{originResult.note}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Compliance Checklist */}
          {activeStep === "compliance" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-card p-6 shadow-md">
                <div className="mb-6 flex items-center gap-4 border-b border-border pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#c99d2e]">
                    <CheckSquare className="h-6 w-6 text-[#1a1a1a]" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold">Compliance Checklist</h2>
                    <p className="text-sm text-muted-foreground">
                      Track your compliance requirements by sector
                    </p>
                  </div>
                  {checklistTotal > 0 && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#2d5016]">
                        {checklistCompleted}/{checklistTotal}
                      </div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <label className="mb-2 block text-sm font-semibold">Select Sector</label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                  >
                    <option value="">Select sector</option>
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {checklistTotal > 0 && (
                  <div className="mb-6">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">Progress</span>
                      <span className="text-muted-foreground">{Math.round(checklistPercent)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-gradient-to-r from-[#D4AF37] to-[#2d5016] transition-all duration-500"
                        style={{ width: `${checklistPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {sector && SECTOR_CHECKLISTS[sector] && (
                  <ul className="space-y-3">
                    {SECTOR_CHECKLISTS[sector].map((item, i) => {
                      const key = `${sector}-${i}`;
                      const checked = checklistProgress[key];
                      return (
                        <li
                          key={key}
                          className="flex items-start gap-4 rounded-lg bg-muted/30 p-4 transition-all hover:bg-muted/50"
                        >
                          <button
                            type="button"
                            onClick={() => toggleChecklistItem(key)}
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-all ${
                              checked
                                ? "border-[#D4AF37] bg-[#D4AF37] text-[#1a1a1a]"
                                : "border-input bg-background"
                            }`}
                          >
                            {checked && <CheckCircle2 className="h-4 w-4" />}
                          </button>
                          <span
                            className={`flex-1 text-sm ${
                              checked ? "text-muted-foreground line-through" : "text-foreground"
                            }`}
                          >
                            {item}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Document Library */}
          {activeStep === "documents" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-card p-6 shadow-md">
                <div className="mb-6 flex items-center gap-4 border-b border-border pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#c99d2e]">
                    <FileText className="h-6 w-6 text-[#1a1a1a]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Document Library</h2>
                    <p className="text-sm text-muted-foreground">
                      Key AfCFTA agreements, protocols, and guidelines
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    { title: "AfCFTA Agreement (Consolidated Text)", type: "Agreement", year: "2018" },
                    { title: "Protocol on Trade in Goods", type: "Protocol", year: "2018" },
                    { title: "Protocol on Rules of Origin", type: "Protocol", year: "2018" },
                    { title: "Tariff Schedules (Phase I)", type: "Schedule", year: "2022" },
                    { title: "Guidelines on Certificate of Origin", type: "Guideline", year: "2022" },
                    { title: "Protocol on Trade in Services", type: "Protocol", year: "2018" },
                    { title: "Annex on Professional Services", type: "Annex", year: "2022" },
                    { title: "Dispute Settlement Mechanism", type: "Procedure", year: "2020" },
                  ].map((doc) => (
                    <div
                      key={doc.title}
                      className="group rounded-lg border-2 border-border bg-background p-4 text-center transition-all hover:border-[#D4AF37] hover:shadow-md"
                    >
                      <div className="mb-2 text-4xl">📄</div>
                      <h3 className="mb-1 font-semibold text-foreground">{doc.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {doc.type} · {doc.year}
                      </p>
                      <button
                        type="button"
                        className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium transition-all hover:bg-accent"
                      >
                        View / Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <button
              type="button"
              onClick={() => {
                const prevIndex = Math.max(0, currentStepIndex - 1);
                setActiveStep(STEPS[prevIndex].id);
              }}
              disabled={currentStepIndex === 0}
              className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent"
            >
              ← Previous
            </button>
            <div className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {STEPS.length}
            </div>
            <button
              type="button"
              onClick={() => {
                const nextIndex = Math.min(STEPS.length - 1, currentStepIndex + 1);
                setActiveStep(STEPS[nextIndex].id);
              }}
              disabled={currentStepIndex === STEPS.length - 1}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-4 py-2 text-sm font-semibold text-[#1a1a1a] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-lg"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
