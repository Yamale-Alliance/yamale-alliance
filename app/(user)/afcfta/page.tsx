"use client";

import { useState, useEffect } from "react";
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
  ChevronRight,
  RotateCcw,
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

const AFCFTA_DOCUMENTS = [
  { title: "AfCFTA Agreement (Consolidated Text)", type: "Agreement", year: "2018", icon: "📄" },
  { title: "Protocol on Trade in Goods", type: "Protocol", year: "2018", icon: "📋" },
  { title: "Protocol on Rules of Origin", type: "Protocol", year: "2018", icon: "🌱" },
  { title: "Tariff Schedules (Phase I)", type: "Schedule", year: "2022", icon: "🏆" },
  { title: "Guidelines on Certificate of Origin", type: "Guideline", year: "2022", icon: "🧪" },
  { title: "Protocol on Trade in Services", type: "Protocol", year: "2018", icon: "📊" },
  { title: "Annex on Professional Services", type: "Annex", year: "2022", icon: "💰" },
  { title: "Dispute Settlement Mechanism", type: "Procedure", year: "2020", icon: "🎯" },
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

type Tab = "tariff" | "origin" | "compliance" | "documents" | "comparison" | "calculator" | "ntb" | "vault" | "audit" | "timeline";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "tariff", label: "Tariff Lookup" },
  { id: "origin", label: "Rules of Origin" },
  { id: "compliance", label: "Compliance" },
  { id: "comparison", label: "Country Comparison" },
  { id: "documents", label: "Documents" },
  { id: "calculator", label: "Tariff Calculator" },
  { id: "ntb", label: "NTB Monitor" },
  { id: "vault", label: "Doc Vault" },
  { id: "audit", label: "Compliance Audit" },
  { id: "timeline", label: "Journey Timeline" },
];

const JOURNEY_STEPS = [
  { id: "registration", label: "Registration", number: 1 },
  { id: "classification", label: "Product Classification", number: 2 },
  { id: "origin", label: "Rules of Origin", number: 3 },
  { id: "tariff", label: "Tariff Reduction", number: 4 },
  { id: "certification", label: "Certification", number: 5 },
  { id: "marketAccess", label: "Market Access", number: 6 },
];

// Tool tabs order for Next/Back navigation; only these 5 show in the top nav (like the design)
const TOOL_NAV_ORDER: Tab[] = ["calculator", "ntb", "vault", "audit", "timeline"];
const TOOL_TABS = TABS.filter((t) => TOOL_NAV_ORDER.includes(t.id));

export default function AfCFTAPage() {
  const [activeTab, setActiveTab] = useState<Tab>("calculator");
  const [registrationCompleted, setRegistrationCompleted] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setRegistrationCompleted(localStorage.getItem("afcfta_registration_completed") === "true");
    }
  }, []);
  const [countryA, setCountryA] = useState("");
  const [countryB, setCountryB] = useState("");
  const [continentA, setContinentA] = useState("");
  const [continentB, setContinentB] = useState("");
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
  // Tariff Calculator states
  const [exportingCountry, setExportingCountry] = useState("");
  const [exportingContinent, setExportingContinent] = useState("");
  const [importingCountry, setImportingCountry] = useState("");
  const [importingContinent, setImportingContinent] = useState("");
  const [calculatorHsCode, setCalculatorHsCode] = useState("");
  const [calculatorCategory, setCalculatorCategory] = useState("");
  const [shipmentValue, setShipmentValue] = useState("");
  const [annualShipments, setAnnualShipments] = useState("");
  const [calculatorResults, setCalculatorResults] = useState<{
    qualifies: boolean;
    mfnRate: number;
    afcftaRate: number;
    dutySaved: number;
    annualSavings: number;
    fiveYearSavings: number;
  } | null>(null);
  // NTB Monitor states
  const [ntbFilter, setNtbFilter] = useState<"all" | "active" | "resolved" | "watch">("all");
  // Reset counter to force re-render
  const [resetKey, setResetKey] = useState(0);

  // Get next and previous tool for bottom navigation (Tariff Calculator → NTB → Doc Vault → Audit → Timeline)
  const getJourneyNavigation = () => {
    const currentIndex = TOOL_NAV_ORDER.indexOf(activeTab);
    const nextTab = currentIndex >= 0 && currentIndex < TOOL_NAV_ORDER.length - 1 ? TOOL_NAV_ORDER[currentIndex + 1] : null;
    const prevTab = currentIndex > 0 ? TOOL_NAV_ORDER[currentIndex - 1] : null;
    const nextLabel = nextTab ? TABS.find((t) => t.id === nextTab)?.label ?? nextTab : null;
    const prevLabel = prevTab ? TABS.find((t) => t.id === prevTab)?.label ?? prevTab : null;
    return { nextTab, prevTab, nextLabel, prevLabel };
  };

  const { nextTab, prevTab, nextLabel, prevLabel } = getJourneyNavigation();

  const getFilteredCountries = (continent: string) => {
    if (!continent) return [];
    return COUNTRIES_BY_CONTINENT[continent] || [];
  };

  const toggleChecklistItem = (key: string) => {
    setChecklistProgress((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const calculateTariffSavings = () => {
    if (!exportingCountry || !importingCountry || !calculatorHsCode || !shipmentValue || !annualShipments) {
      return;
    }
    // Mock calculation - in real app, this would call an API
    const mfnRate = 12.5; // Example MFN rate
    const afcftaRate = 0; // AfCFTA preferential rate
    const shipmentVal = parseFloat(shipmentValue);
    const annualShip = parseInt(annualShipments) || 1;
    
    const dutySaved = (shipmentVal * mfnRate) / 100;
    const annualSavings = dutySaved * annualShip;
    const fiveYearSavings = annualSavings * 5;

    setCalculatorResults({
      qualifies: true,
      mfnRate,
      afcftaRate,
      dutySaved,
      annualSavings,
      fiveYearSavings,
    });
  };

  const resetCalculator = () => {
    setExportingCountry("");
    setExportingContinent("");
    setImportingCountry("");
    setImportingContinent("");
    setCalculatorHsCode("");
    setCalculatorCategory("");
    setShipmentValue("");
    setAnnualShipments("");
    setCalculatorResults(null);
  };

  const resetJourney = () => {
    // Clear all form state and registration; start journey from step 1
    if (typeof window !== "undefined") {
      localStorage.removeItem("afcfta_registration_completed");
      localStorage.removeItem("afcfta_registration_data");
    }
    setRegistrationCompleted(false);
    setActiveTab("calculator");
    setHsCode("");
    setProductValue("");
    setDestinationCountry("");
    setDestinationContinent("");
    setOriginCountry("");
    setDestCountry("");
    setOriginContinent("");
    setDestContinent("");
    setProductCategory("");
    setSector("");
    setChecklistProgress({});
    setCountryA("");
    setCountryB("");
    setContinentA("");
    setContinentB("");
    setExportingCountry("");
    setExportingContinent("");
    setImportingCountry("");
    setImportingContinent("");
    setCalculatorHsCode("");
    setCalculatorCategory("");
    setShipmentValue("");
    setAnnualShipments("");
    setCalculatorResults(null);
    // Increment reset key to force complete re-render
    setResetKey((prev) => prev + 1);
  };

  const originResult =
    originCountry && destCountry && productCategory
      ? getMockOriginResult(productCategory, originCountry, destCountry)
      : null;

  const checklistItems = sector ? SECTOR_CHECKLISTS[sector] || [] : [];
  const checklistCompleted = checklistItems.filter((_, i) => checklistProgress[`${sector}-${i}`]).length;
  const checklistTotal = checklistItems.length;
  const checklistPercent = checklistTotal > 0 ? (checklistCompleted / checklistTotal) * 100 : 0;

  // Journey progress: 6 steps based on user actions (registration = completed on /afcfta/registration)
  const journeyProgress = {
    registration: registrationCompleted,
    classification: !!hsCode,
    origin: !!(originCountry && destCountry && productCategory),
    tariff: !!(hsCode && destinationCountry) || !!calculatorResults,
    certification: !!(sector && checklistTotal > 0 && checklistCompleted === checklistTotal),
    marketAccess: (() => {
      const prev = [registrationCompleted, !!hsCode, !!(originCountry && destCountry && productCategory), (!!(hsCode && destinationCountry) || !!calculatorResults), !!(sector && checklistTotal > 0 && checklistCompleted === checklistTotal)];
      return prev.every(Boolean);
    })(),
  };
  const completedJourneySteps = Object.values(journeyProgress).filter(Boolean).length;
  const firstIncompleteIndex = JOURNEY_STEPS.findIndex((step) => !journeyProgress[step.id as keyof typeof journeyProgress]);
  const currentJourneyIndex = firstIncompleteIndex === -1 ? JOURNEY_STEPS.length - 1 : firstIncompleteIndex;
  const journeyProgressPercent = (completedJourneySteps / JOURNEY_STEPS.length) * 100;

  // Mock savings calculation
  const mockSavings = hsCode && productValue
    ? (parseFloat(productValue) * 0.15).toLocaleString("en-US", { style: "currency", currency: "USD" })
    : null;
  const mockTariffRate = hsCode ? "5.2%" : null;
  const mockAfCFTARate = hsCode ? "2.1%" : null;

  return (
    <div key={resetKey} className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {/* Page heading: Your AfCFTA Compliance Journey — on top, modern, prominent */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
              Your AfCFTA Compliance Journey
            </h1>
            <button
              type="button"
              onClick={resetJourney}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Journey
            </button>
          </div>
          {/* 6-step progress bar: gold = completed, dark green = current, grey = pending (match design) */}
          <div className="relative flex justify-between mt-6 gap-0 px-1">
            {/* Connector line behind circles: grey full width, then gold/green fill to current step */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-[#e0e0e0]" style={{ left: "1.25rem", right: "1.25rem" }} />
            <div
              className="absolute top-5 left-0 h-0.5 transition-all duration-500"
              style={{
                left: "1.25rem",
                width: `calc(${((currentJourneyIndex + 0.5) / JOURNEY_STEPS.length) * 100}% - 1.25rem)`,
                background: "linear-gradient(90deg, #D4AF37, #2d5016)",
              }}
            />
            {JOURNEY_STEPS.map((step, idx) => {
              const isCompleted = journeyProgress[step.id as keyof typeof journeyProgress];
              const isActive = idx === currentJourneyIndex && !isCompleted;
              const isRegistration = step.id === "registration";
              const content = (
                <>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 shrink-0 border-2 ${
                      isCompleted
                        ? "border-[#D4AF37] bg-[#D4AF37] text-[#1a1a1a]"
                        : isActive
                          ? "border-[#2d5016] bg-[#2d5016] text-white scale-110"
                          : "border-[#e0e0e0] bg-white text-[#666]"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <span>{step.number}</span>
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium text-center leading-tight truncate w-full max-w-[4.5rem] sm:max-w-none ${
                      isCompleted ? "text-[#D4AF37]" : isActive ? "text-[#2d5016]" : "text-[#666]"
                    }`}
                  >
                    {step.label}
                  </span>
                </>
              );
              return (
                <div key={step.id} className="flex flex-col items-center relative z-10 flex-1 min-w-0">
                  {isRegistration && !isCompleted ? (
                    <Link href="/afcfta/registration" className="flex flex-col items-center focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 rounded-full">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tool tabs: only 5 — gold active, gold text for inactive; no dark background */}
        <nav className="flex flex-wrap gap-2 mb-8 rounded-xl px-3 py-2" aria-label="AfCFTA tools">
          {TOOL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[#D4AF37] text-[#1a1a1a] shadow-sm"
                  : "text-[#D4AF37] hover:bg-[#D4AF37]/20 hover:text-[#e8c55a]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Tab 1: Tariff Lookup */}
          {activeTab === "tariff" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border/60">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                    📊
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground">Tariff Schedule Lookup</h2>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
                      <div className="flex flex-col">
                        <label className="mb-2 text-sm font-medium text-foreground">HS Code</label>
                        <input
                          type="text"
                          value={hsCode}
                          onChange={(e) => setHsCode(e.target.value)}
                          placeholder="e.g., 0101.21"
                          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="mb-2 text-sm font-medium text-foreground">Product Value (USD)</label>
                        <input
                          type="number"
                          value={productValue}
                          onChange={(e) => setProductValue(e.target.value)}
                          placeholder="e.g., 10000"
                          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <label className="mb-2 font-semibold text-[#1a1a1a]">Continent</label>
                      <select
                        value={destinationContinent}
                        onChange={(e) => {
                          setDestinationContinent(e.target.value);
                          setDestinationCountry("");
                        }}
                        className="px-3 py-3 border-2 border-[#e0e0e0] rounded-lg text-base transition-all duration-300 focus:outline-none focus:border-[#D4AF37] focus:shadow-[0_0_0_3px_rgba(212,175,55,0.1)]"
                      >
                        <option value="">Select continent</option>
                        {CONTINENTS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="mb-2 font-semibold text-[#1a1a1a]">Destination Country</label>
                      <select
                        value={destinationCountry}
                        onChange={(e) => setDestinationCountry(e.target.value)}
                        disabled={!destinationContinent}
                        className="px-3 py-3 border-2 border-[#e0e0e0] rounded-lg text-base transition-all duration-300 focus:outline-none focus:border-[#D4AF37] focus:shadow-[0_0_0_3px_rgba(212,175,55,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border-none rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] text-[#1a1a1a] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(212,175,55,0.3)]"
                    >
                      <Search className="h-5 w-5" />
                      Search Full Tariff Schedule
                    </Link>
                  </div>

                  {(hsCode || mockSavings) && (
                    <div className="bg-gradient-to-br from-white to-[#fafafa] rounded-xl p-6 border-2 border-[#e8e8e8] mt-8">
                      <h3 className="mb-4 text-lg font-semibold">Estimated Savings</h3>
                      <div className="grid gap-6 sm:grid-cols-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
                        <div className="bg-gradient-to-br from-white to-[#fafafa] rounded-xl p-6 border-2 border-[#e8e8e8] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)]">
                          <div className="text-[0.9rem] text-[#666] mb-2 uppercase font-semibold tracking-wider">
                            MFN Rate
                          </div>
                          <div className="text-3xl font-bold text-[#1a1a1a]">{mockTariffRate || "—"}</div>
                        </div>
                        <div className="bg-gradient-to-br from-white to-[#fafafa] rounded-xl p-6 border-2 border-[#e8e8e8] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)]">
                          <div className="text-[0.9rem] text-[#666] mb-2 uppercase font-semibold tracking-wider">
                            AfCFTA Rate
                          </div>
                          <div className="text-3xl font-bold text-[#2d5016]">{mockAfCFTARate || "—"}</div>
                        </div>
                      </div>
                      {mockSavings && (
                        <div className="bg-gradient-to-r from-[#2d5016] to-[#3a6a1d] text-white p-8 rounded-xl text-center mt-6">
                          <p className="text-sm uppercase tracking-wider opacity-90">Potential Annual Savings</p>
                          <p className="text-5xl font-bold my-4">{mockSavings}</p>
                          <p className="text-sm opacity-80">on $10,000 shipment</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Rules of Origin */}
          {activeTab === "origin" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-xl p-8 mb-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border-l-4 border-l-[#D4AF37]">
                <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-[#f0f0f0]">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#D4AF37] to-[#e8c55a] rounded-xl flex items-center justify-center text-2xl">
                    🧪
                  </div>
                  <h2 className="text-2xl font-bold text-[#1a1a1a]">Rules of Origin Calculator</h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Product Category</label>
                    <select
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                      className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10"
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
                        <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Origin Continent</label>
                        <select
                          value={originContinent}
                          onChange={(e) => {
                            setOriginContinent(e.target.value);
                            setOriginCountry("");
                          }}
                          className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10"
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
                        <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Country of Origin</label>
                        <select
                          value={originCountry}
                          onChange={(e) => setOriginCountry(e.target.value)}
                          disabled={!originContinent}
                          className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Destination Continent</label>
                        <select
                          value={destContinent}
                          onChange={(e) => {
                            setDestContinent(e.target.value);
                            setDestCountry("");
                          }}
                          className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10"
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
                        <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Destination Country</label>
                        <select
                          value={destCountry}
                          onChange={(e) => setDestCountry(e.target.value)}
                          disabled={!destContinent}
                          className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className={`mt-6 flex items-start gap-4 rounded-lg border-l-4 p-4 ${
                      originResult.eligible
                        ? "border-green-500 bg-[#d4edda] text-[#155724]"
                        : "border-amber-500 bg-[#fff3cd] text-[#856404]"
                    }`}
                  >
                    {originResult.eligible ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {originResult.eligible
                          ? "May qualify for preferential treatment"
                          : "Verify rules of origin"}
                      </p>
                      <p className="mt-1 text-sm opacity-90">{originResult.note}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Compliance Checklist */}
          {activeTab === "compliance" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-white p-6 shadow-md">
                <div className="mb-6 flex items-center justify-between border-b-2 border-[#f0f0f0] pb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#e8c55a] text-2xl">
                      📋
                    </div>
                    <h2 className="text-2xl font-bold text-[#1a1a1a]">Compliance Checklist</h2>
                  </div>
                  {checklistTotal > 0 && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#2d5016]">
                        {checklistCompleted}/{checklistTotal}
                      </div>
                      <div className="text-xs text-[#666]">Completed</div>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Select Sector</label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10"
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
                      <span className="font-semibold">Progress</span>
                      <span className="text-[#666]">{Math.round(checklistPercent)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#e0e0e0]">
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
                          className="flex items-center gap-4 rounded-lg bg-[#f8f9fa] p-4 transition-all hover:translate-x-1 hover:bg-[#e9ecef]"
                        >
                          <button
                            type="button"
                            onClick={() => toggleChecklistItem(key)}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-all ${
                              checked
                                ? "border-[#D4AF37] bg-[#D4AF37]"
                                : "border-[#D4AF37] bg-white"
                            }`}
                          >
                            {checked && <CheckCircle2 className="h-4 w-4 text-white" />}
                          </button>
                          <span
                            className={`flex-1 text-sm ${
                              checked ? "text-[#666] line-through" : "text-[#1a1a1a]"
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

          {/* Tab 4: Country Comparison */}
          {activeTab === "comparison" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-white p-6 shadow-md">
                <div className="mb-6 flex items-center gap-4 border-b-2 border-[#f0f0f0] pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#e8c55a] text-2xl">
                    📊
                  </div>
                  <h2 className="text-2xl font-bold text-[#1a1a1a]">Country Comparison Tool</h2>
                </div>

                <div className="mb-6 grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Continent A</label>
                      <select
                        value={continentA}
                        onChange={(e) => {
                          setContinentA(e.target.value);
                          setCountryA("");
                        }}
                        className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10"
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
                      <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Country A</label>
                      <select
                        value={countryA}
                        onChange={(e) => setCountryA(e.target.value)}
                        disabled={!continentA}
                        className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select country</option>
                        {getFilteredCountries(continentA).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Continent B</label>
                      <select
                        value={continentB}
                        onChange={(e) => {
                          setContinentB(e.target.value);
                          setCountryB("");
                        }}
                        className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10"
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
                      <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Country B</label>
                      <select
                        value={countryB}
                        onChange={(e) => setCountryB(e.target.value)}
                        disabled={!continentB}
                        className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select country</option>
                        {getFilteredCountries(continentB).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {countryA && countryB && (
                  <div className="overflow-x-auto rounded-lg border border-[#e0e0e0]">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#1a1a1a] text-white">
                          <th className="px-4 py-3 text-left font-semibold">Requirement</th>
                          <th className="px-4 py-3 text-left font-semibold">{countryA}</th>
                          <th className="px-4 py-3 text-left font-semibold">{countryB}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MOCK_COMPARISON_FIELDS.map((field) => (
                          <tr key={field} className="border-b border-[#e0e0e0] transition-colors hover:bg-[#f8f9fa] last:border-0">
                            <td className="px-4 py-3 text-[#666]">{field}</td>
                            <td className="px-4 py-3">{getMockComparisonValue(countryA, field)}</td>
                            <td className="px-4 py-3">{getMockComparisonValue(countryB, field)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 5: Document Library */}
          {activeTab === "documents" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-white p-6 shadow-md">
                <div className="mb-6 flex items-center gap-4 border-b-2 border-[#f0f0f0] pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#e8c55a] text-2xl">
                    📁
                  </div>
                  <h2 className="text-2xl font-bold text-[#1a1a1a]">Document Library</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {AFCFTA_DOCUMENTS.map((doc) => (
                    <div
                      key={doc.title}
                      className="group cursor-pointer rounded-lg border-2 border-[#e0e0e0] bg-white p-4 text-center transition-all hover:border-[#D4AF37] hover:-translate-y-1 hover:shadow-md"
                    >
                      <div className="mb-2 text-4xl">{doc.icon}</div>
                      <h3 className="mb-1 font-semibold text-[#1a1a1a]">{doc.title}</h3>
                      <p className="text-xs text-[#666]">
                        {doc.type} · {doc.year}
                      </p>
                      <button
                        type="button"
                        className="mt-3 w-full rounded-lg border border-[#e0e0e0] bg-background px-3 py-2 text-sm font-medium transition-all hover:bg-[#f8f9fa]"
                      >
                        View / Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 6: Tariff Calculator */}
          {activeTab === "calculator" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm">
                <div className="mb-6">
                  <h2 className="mb-2 text-2xl font-bold text-[#1a1a1a]">AfCFTA Tariff Savings Calculator</h2>
                  <p className="text-sm text-[#666]">Compare MFN rates vs preferential AfCFTA duties</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Exporting Country</label>
                        <div className="space-y-2">
                          <select
                            value={exportingContinent}
                            onChange={(e) => {
                              setExportingContinent(e.target.value);
                              setExportingCountry("");
                            }}
                            className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-2 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10"
                          >
                            <option value="">Continent</option>
                            {CONTINENTS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <select
                            value={exportingCountry}
                            onChange={(e) => setExportingCountry(e.target.value)}
                            disabled={!exportingContinent}
                            className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">Select country</option>
                            {getFilteredCountries(exportingContinent).map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Importing Country</label>
                        <div className="space-y-2">
                          <select
                            value={importingContinent}
                            onChange={(e) => {
                              setImportingContinent(e.target.value);
                              setImportingCountry("");
                            }}
                            className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-2 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10"
                          >
                            <option value="">Continent</option>
                            {CONTINENTS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <select
                            value={importingCountry}
                            onChange={(e) => setImportingCountry(e.target.value)}
                            disabled={!importingContinent}
                            className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">Select country</option>
                            {getFilteredCountries(importingContinent).map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">HS Code</label>
                      <input
                        type="text"
                        value={calculatorHsCode}
                        onChange={(e) => setCalculatorHsCode(e.target.value)}
                        placeholder="0901.11"
                        className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Product Category</label>
                      <select
                        value={calculatorCategory}
                        onChange={(e) => setCalculatorCategory(e.target.value)}
                        className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10"
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
                      <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Shipment Value (USD)</label>
                      <input
                        type="number"
                        value={shipmentValue}
                        onChange={(e) => setShipmentValue(e.target.value)}
                        placeholder="250000"
                        className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#1a1a1a]">Annual Shipments</label>
                      <input
                        type="number"
                        value={annualShipments}
                        onChange={(e) => setAnnualShipments(e.target.value)}
                        placeholder="12"
                        className="w-full rounded-lg border-2 border-[#e0e0e0] bg-background px-4 py-3 text-sm transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={calculateTariffSavings}
                        className="flex-1 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-6 py-3 font-semibold text-[#1a1a1a] transition-all hover:scale-[1.02] hover:shadow-lg"
                      >
                        ⚡ Calculate Savings
                      </button>
                      <button
                        type="button"
                        onClick={resetCalculator}
                        className="rounded-lg border-2 border-[#e0e0e0] bg-background px-6 py-3 font-semibold text-[#666] transition-all hover:bg-[#f8f9fa]"
                      >
                        ↺ Reset
                      </button>
                    </div>
                  </div>

                  {calculatorResults && (
                    <div className="space-y-4">
                      <div className="rounded-lg border-2 border-green-500/20 bg-green-50/50 p-6">
                        <div className="mb-4 flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <p className="font-semibold text-green-800">
                            Your product qualifies for AfCFTA preferential treatment. See your savings breakdown below.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-lg bg-[#f8f9fa] p-4">
                          <span className="text-sm font-semibold text-[#666]">Standard MFN Rate</span>
                          <span className="text-xl font-bold text-[#1a1a1a]">{calculatorResults.mfnRate}%</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-green-500/10 p-4">
                          <span className="text-sm font-semibold text-green-700">AfCFTA Preferential Rate</span>
                          <span className="text-xl font-bold text-green-700">{calculatorResults.afcftaRate}%</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-blue-500/10 p-4">
                          <span className="text-sm font-semibold text-blue-700">Duty Saved Per Shipment</span>
                          <span className="text-xl font-bold text-blue-700">
                            ${calculatorResults.dutySaved.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-purple-500/10 p-4">
                          <span className="text-sm font-semibold text-purple-700">Annual Potential Savings</span>
                          <span className="text-xl font-bold text-purple-700">
                            ${calculatorResults.annualSavings.toLocaleString()}
                          </span>
                        </div>
                        <div className="rounded-lg bg-gradient-to-r from-[#2d5016] to-[#3a6a1d] p-6 text-center text-white">
                          <div className="text-sm uppercase tracking-wider opacity-90">🏆 Total 5-Year Projected Savings</div>
                          <div className="mt-2 text-4xl font-bold">${calculatorResults.fiveYearSavings.toLocaleString()}</div>
                          <div className="mt-2 text-xs opacity-80">
                            Based on current AfCFTA schedule — tariffs phased to 0% over 5 years for sensitive goods
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[#e0e0e0] bg-white p-4">
                        <h3 className="mb-3 font-semibold text-[#1a1a1a]">Rate Comparison by Regime</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#e0e0e0]">
                                <th className="px-3 py-2 text-left font-semibold text-[#666]">Trade Regime</th>
                                <th className="px-3 py-2 text-right font-semibold text-[#666]">Applicable Rate</th>
                                <th className="px-3 py-2 text-right font-semibold text-[#666]">Duty on ${parseInt(shipmentValue || "0").toLocaleString()}</th>
                                <th className="px-3 py-2 text-right font-semibold text-[#666]">vs. AfCFTA</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-[#e0e0e0]">
                                <td className="px-3 py-2">WTO MFN (Standard)</td>
                                <td className="px-3 py-2 text-right">{calculatorResults.mfnRate}%</td>
                                <td className="px-3 py-2 text-right">${calculatorResults.dutySaved.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right text-red-600">−${calculatorResults.dutySaved.toLocaleString()} disadvantage</td>
                              </tr>
                              <tr className="border-b border-[#e0e0e0]">
                                <td className="px-3 py-2">ECOWAS / Regional</td>
                                <td className="px-3 py-2 text-right">6%</td>
                                <td className="px-3 py-2 text-right">
                                  ${((parseFloat(shipmentValue || "0") * 6) / 100).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right text-red-600">
                                  −${((parseFloat(shipmentValue || "0") * 6) / 100).toLocaleString()} disadvantage
                                </td>
                              </tr>
                              <tr className="bg-green-50">
                                <td className="px-3 py-2 font-semibold">AfCFTA Preferential ✓</td>
                                <td className="px-3 py-2 text-right font-semibold">{calculatorResults.afcftaRate}%</td>
                                <td className="px-3 py-2 text-right font-semibold">$0</td>
                                <td className="px-3 py-2 text-right font-semibold text-green-700">Best rate</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                        <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 shrink-0 text-blue-600" />
                          <p className="text-sm text-blue-800">
                            Competitor firms NOT using AfCFTA are paying ${calculatorResults.dutySaved.toLocaleString()} per shipment more than you — a{" "}
                            {((calculatorResults.dutySaved / parseFloat(shipmentValue || "1")) * 100).toFixed(1)}% price advantage for your buyers.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Navigation buttons */}
                <div className="mt-8 flex items-center justify-between gap-4 border-t border-border/60 pt-6">
                  {prevTab ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab(prevTab)}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                      Back
                    </button>
                  ) : (
                    <div />
                  )}
                  {nextTab && nextLabel && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(nextTab)}
                      className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-emerald-600 px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:shadow-lg"
                    >
                      Next: {nextLabel}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 7: NTB Monitor */}
          {activeTab === "ntb" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm">
                <div className="mb-6">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-2xl">🚨</span>
                    <h2 className="text-2xl font-bold text-[#1a1a1a]">Non-Tariff Barrier Monitor</h2>
                  </div>
                  <p className="text-sm text-[#666]">Live AfCFTA NTB reporting & resolution tracker</p>
                </div>

                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setNtbFilter("all")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                        ntbFilter === "all"
                          ? "bg-[#D4AF37] text-[#1a1a1a] shadow-md"
                          : "bg-[#f8f9fa] text-[#666] hover:bg-[#e9ecef]"
                      }`}
                    >
                      All Barriers
                    </button>
                    <button
                      type="button"
                      onClick={() => setNtbFilter("active")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                        ntbFilter === "active"
                          ? "bg-amber-500 text-white shadow-md"
                          : "bg-[#f8f9fa] text-[#666] hover:bg-[#e9ecef]"
                      }`}
                    >
                      Active ⚠
                    </button>
                    <button
                      type="button"
                      onClick={() => setNtbFilter("resolved")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                        ntbFilter === "resolved"
                          ? "bg-green-500 text-white shadow-md"
                          : "bg-[#f8f9fa] text-[#666] hover:bg-[#e9ecef]"
                      }`}
                    >
                      Resolved ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => setNtbFilter("watch")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                        ntbFilter === "watch"
                          ? "bg-yellow-500 text-white shadow-md"
                          : "bg-[#f8f9fa] text-[#666] hover:bg-[#e9ecef]"
                      }`}
                    >
                      Watch List
                    </button>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-6 py-2 font-semibold text-[#1a1a1a] transition-all hover:scale-[1.02] hover:shadow-lg"
                  >
                    📋 Report a New NTB
                  </button>
                </div>

                <div className="space-y-4">
                  {(ntbFilter === "all" || ntbFilter === "active") && (
                    <div className="rounded-lg border border-[#e0e0e0] bg-white p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="inline-block rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-700">
                          Active
                        </span>
                        <span className="text-xs text-[#666]">Updated 2 days ago</span>
                      </div>
                      <h3 className="mb-2 font-semibold text-[#1a1a1a]">
                        SPS Requirements - Ghana → Nigeria
                      </h3>
                      <p className="mb-3 text-sm text-[#666]">
                        New phytosanitary certificate requirements for agricultural products. Additional testing required
                        for certain categories.
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#666]">
                        <span>Category: Agriculture</span>
                        <span>Impact: Medium</span>
                        <span>Status: Under Review</span>
                      </div>
                    </div>
                  )}

                  {(ntbFilter === "all" || ntbFilter === "resolved") && (
                    <div className="rounded-lg border border-[#e0e0e0] bg-white p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="inline-block rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-700">
                          Resolved
                        </span>
                        <span className="text-xs text-[#666]">Resolved 1 week ago</span>
                      </div>
                      <h3 className="mb-2 font-semibold text-[#1a1a1a]">
                        Customs Documentation - Kenya → South Africa
                      </h3>
                      <p className="mb-3 text-sm text-[#666]">
                        Streamlined documentation process implemented. Reduced clearance time by 40%.
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#666]">
                        <span>Category: Customs</span>
                        <span>Impact: Low</span>
                        <span>Status: Resolved</span>
                      </div>
                    </div>
                  )}

                  {(ntbFilter === "all" || ntbFilter === "watch") && (
                    <div className="rounded-lg border border-[#e0e0e0] bg-white p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="inline-block rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-700">
                          Watch
                        </span>
                        <span className="text-xs text-[#666]">Updated 5 days ago</span>
                      </div>
                      <h3 className="mb-2 font-semibold text-[#1a1a1a]">
                        Technical Standards - Senegal → Côte d'Ivoire
                      </h3>
                      <p className="mb-3 text-sm text-[#666]">
                        Proposed harmonization of technical standards for electronics. Public consultation ongoing.
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#666]">
                        <span>Category: Standards</span>
                        <span>Impact: High</span>
                        <span>Status: Under Review</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Navigation buttons */}
                <div className="mt-8 flex items-center justify-between gap-4 border-t border-border/60 pt-6">
                  {prevTab ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab(prevTab)}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                      Back
                    </button>
                  ) : (
                    <div />
                  )}
                  {nextTab && nextLabel && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(nextTab)}
                      className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-emerald-600 px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:shadow-lg"
                    >
                      Next: {nextLabel}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 8: Doc Vault */}
          {activeTab === "vault" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm">
                <div className="mb-6 flex items-center gap-4 border-b-2 border-[#f0f0f0] pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#e8c55a] text-2xl">
                    🔒
                  </div>
                  <h2 className="text-2xl font-bold text-[#1a1a1a]">Document Vault</h2>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-[#666]">
                    Secure storage for your AfCFTA compliance documents. Upload, organize, and access your certificates
                    and documentation.
                  </p>
                </div>

                <div className="mb-6 rounded-lg border-2 border-dashed border-[#e0e0e0] bg-[#f8f9fa] p-8 text-center">
                  <div className="mb-4 text-4xl">📤</div>
                  <h3 className="mb-2 font-semibold text-[#1a1a1a]">Upload Documents</h3>
                  <p className="mb-4 text-sm text-[#666]">
                    Drag and drop files here or click to browse
                  </p>
                  <button
                    type="button"
                    className="rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-6 py-2 font-semibold text-[#1a1a1a] transition-all hover:scale-[1.02] hover:shadow-lg"
                  >
                    Choose Files
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {AFCFTA_DOCUMENTS.slice(0, 6).map((doc) => (
                    <div
                      key={doc.title}
                      className="group cursor-pointer rounded-lg border-2 border-[#e0e0e0] bg-white p-4 transition-all hover:border-[#D4AF37] hover:-translate-y-1 hover:shadow-md"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-3xl">{doc.icon}</div>
                        <span className="text-xs text-[#666]">{doc.type}</span>
                      </div>
                      <h3 className="mb-2 font-semibold text-[#1a1a1a]">{doc.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-[#666]">
                        <Clock className="h-3 w-3" />
                        <span>Uploaded {doc.year}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-lg border border-[#e0e0e0] bg-background px-3 py-2 text-sm font-medium transition-all hover:bg-[#f8f9fa]"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-lg border border-[#e0e0e0] bg-background px-3 py-2 text-sm font-medium transition-all hover:bg-[#f8f9fa]"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Navigation buttons */}
                <div className="mt-8 flex items-center justify-between gap-4 border-t border-border/60 pt-6">
                  {prevTab ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab(prevTab)}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                      Back
                    </button>
                  ) : (
                    <div />
                  )}
                  {nextTab && nextLabel && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(nextTab)}
                      className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-emerald-600 px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:shadow-lg"
                    >
                      Next: {nextLabel}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 9: Compliance Audit */}
          {activeTab === "audit" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-white p-6 shadow-md">
                <div className="mb-6 flex items-center gap-4 border-b-2 border-[#f0f0f0] pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#e8c55a] text-2xl">
                    ✅
                  </div>
                  <h2 className="text-2xl font-bold text-[#1a1a1a]">Compliance Audit</h2>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-[#666]">
                    Comprehensive audit of your AfCFTA compliance status across all requirements.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="rounded-lg border-2 border-green-500/20 bg-green-50/50 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-[#1a1a1a]">Registration Status</h3>
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="mb-2 text-sm text-[#666]">✓ Registered with AfCFTA Secretariat</p>
                    <p className="text-sm text-[#666]">Registration Date: January 15, 2024</p>
                  </div>

                  <div className="rounded-lg border-2 border-green-500/20 bg-green-50/50 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-[#1a1a1a]">Product Classification</h3>
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="mb-2 text-sm text-[#666]">✓ HS Codes verified and documented</p>
                    <p className="text-sm text-[#666]">Products Classified: 12 items</p>
                  </div>

                  <div className="rounded-lg border-2 border-amber-500/20 bg-amber-50/50 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-[#1a1a1a]">Rules of Origin</h3>
                      <AlertCircle className="h-6 w-6 text-amber-600" />
                    </div>
                    <p className="mb-2 text-sm text-[#666]">⚠ Some products require additional documentation</p>
                    <p className="text-sm text-[#666]">Completion: 8/12 products verified</p>
                  </div>

                  <div className="rounded-lg border-2 border-blue-500/20 bg-blue-50/50 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-[#1a1a1a]">Tariff Reduction</h3>
                      <Info className="h-6 w-6 text-blue-600" />
                    </div>
                    <p className="mb-2 text-sm text-[#666]">ℹ Reviewing tariff schedules for 2026-2035</p>
                    <p className="text-sm text-[#666]">Status: In Progress</p>
                  </div>

                  <div className="rounded-lg border-2 border-gray-500/20 bg-gray-50/50 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-[#1a1a1a]">Certification</h3>
                      <Clock className="h-6 w-6 text-gray-600" />
                    </div>
                    <p className="mb-2 text-sm text-[#666]">⏳ Certificates pending renewal</p>
                    <p className="text-sm text-[#666]">Next Review: March 2024</p>
                  </div>
                </div>

                <div className="mt-6 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] p-6 text-center text-[#1a1a1a]">
                  <div className="text-sm font-semibold uppercase tracking-wider opacity-90">
                    Overall Compliance Score
                  </div>
                  <div className="mt-2 text-5xl font-bold">78%</div>
                  <div className="mt-2 text-sm opacity-80">Good standing</div>
                </div>

                {/* Navigation buttons */}
                <div className="mt-8 flex items-center justify-between gap-4 border-t border-border/60 pt-6">
                  {prevTab ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab(prevTab)}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                      Back
                    </button>
                  ) : (
                    <div />
                  )}
                  {nextTab && nextLabel && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(nextTab)}
                      className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-emerald-600 px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:shadow-lg"
                    >
                      Next: {nextLabel}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 10: Journey Timeline */}
          {activeTab === "timeline" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm">
                <div className="mb-6 flex items-center gap-4 border-b-2 border-[#f0f0f0] pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#e8c55a] text-2xl">
                    📅
                  </div>
                  <h2 className="text-2xl font-bold text-[#1a1a1a]">Journey Timeline</h2>
                </div>

                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#D4AF37] to-[#2d5016]" />

                  <div className="space-y-8">
                    {JOURNEY_STEPS.map((step, idx) => {
                      const isCompleted = journeyProgress[step.id as keyof typeof journeyProgress];
                      const isActive = idx === currentJourneyIndex && !isCompleted;
                      const continueTab: Tab | null =
                        step.id === "registration"
                          ? null
                          : step.id === "classification"
                            ? "tariff"
                            : step.id === "origin"
                              ? "origin"
                              : step.id === "tariff"
                                ? "calculator"
                                : step.id === "certification"
                                  ? "audit"
                                  : step.id === "marketAccess"
                                    ? "timeline"
                                    : null;
                      const continueHref = step.id === "registration" ? "/afcfta/registration" : null;
                      const descriptions: Record<string, string> = {
                        registration: "Register your business and get started with AfCFTA compliance.",
                        classification: "Classify your product with the correct HS code for customs and tariffs.",
                        origin: "Verify rules of origin for your product between origin and destination countries.",
                        tariff: "Check tariff reduction schedules and calculate preferential vs MFN duties.",
                        certification: "Complete sector requirements and obtain necessary certifications.",
                        marketAccess: "Access markets under AfCFTA preferences and track your compliance.",
                      };
                      return (
                        <div key={step.id} className="relative flex gap-6">
                          <div
                            className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-3 transition-all ${
                              isCompleted
                                ? "border-[#D4AF37] bg-[#D4AF37] text-[#1a1a1a]"
                                : isActive
                                  ? "border-[#2d5016] bg-[#2d5016] text-white scale-110"
                                  : "border-[#e0e0e0] bg-white text-[#666]"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-6 w-6" />
                            ) : (
                              <span className="font-bold">{step.number}</span>
                            )}
                          </div>
                          <div className="flex-1 rounded-lg border border-[#e0e0e0] bg-white p-4 shadow-sm">
                            <div className="mb-2 flex items-center justify-between">
                              <h3 className="font-semibold text-[#1a1a1a]">{step.label}</h3>
                              {isCompleted && (
                                <span className="text-xs font-semibold text-green-600">Completed</span>
                              )}
                              {isActive && <span className="text-xs font-semibold text-[#2d5016]">In Progress</span>}
                              {!isCompleted && !isActive && (
                                <span className="text-xs font-semibold text-[#666]">Pending</span>
                              )}
                            </div>
                            <p className="text-sm text-[#666]">{descriptions[step.id] ?? step.label}</p>
                            {isActive && (continueHref || continueTab) && (
                              continueHref ? (
                                <Link
                                  href={continueHref}
                                  className="mt-3 inline-block rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-4 py-2 text-sm font-semibold text-[#1a1a1a] transition-all hover:scale-[1.02] hover:shadow-lg"
                                >
                                  Continue →
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  className="mt-3 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-4 py-2 text-sm font-semibold text-[#1a1a1a] transition-all hover:scale-[1.02] hover:shadow-lg"
                                  onClick={() => continueTab && setActiveTab(continueTab)}
                                >
                                  Continue →
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Navigation buttons */}
                <div className="mt-8 flex items-center justify-between gap-4 border-t border-border/60 pt-6">
                  {prevTab ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab(prevTab)}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                      Back
                    </button>
                  ) : (
                    <div />
                  )}
                  {nextTab && nextLabel && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(nextTab)}
                      className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-emerald-600 px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:shadow-lg"
                    >
                      Next: {nextLabel}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
