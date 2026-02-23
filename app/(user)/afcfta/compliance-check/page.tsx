"use client";

import { useState } from "react";
import {
  FileText,
  CheckSquare,
  Calculator,
  Table,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Upload,
  ChevronRight,
  ChevronLeft,
  Shield,
  TrendingDown,
  FileCheck,
} from "lucide-react";

const CONTINENTS = ["Africa", "Asia", "Europe", "Americas", "Oceania"];

const COUNTRIES_BY_CONTINENT: Record<string, string[]> = {
  Africa: [
    "Ghana", "Nigeria", "Kenya", "South Africa", "Senegal", "Tanzania", "Rwanda",
    "Côte d'Ivoire", "Egypt", "Ethiopia", "Cameroon", "Morocco", "Algeria", "Angola",
    "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Central African Republic",
    "Chad", "Comoros", "Congo", "Djibouti", "Equatorial Guinea", "Eritrea", "Eswatini",
    "Gabon", "Gambia", "Guinea", "Guinea-Bissau", "Lesotho", "Liberia", "Libya",
    "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Mozambique", "Namibia",
    "Niger", "São Tomé and Príncipe", "Seychelles", "Sierra Leone", "Somalia", "South Sudan",
    "Sudan", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe",
  ],
  Asia: ["China", "India", "Japan", "South Korea", "Singapore", "UAE", "Saudi Arabia"],
  Europe: ["United Kingdom", "France", "Germany", "Italy", "Spain", "Netherlands"],
  Americas: ["United States", "Canada", "Brazil", "Mexico", "Argentina"],
  Oceania: ["Australia", "New Zealand"],
};

const RVC_THRESHOLD = 40;

type StepId = "start" | "production" | "origin" | "ntb" | "tariff" | "checklist";

const STEPS: Array<{ id: StepId; label: string; icon: typeof Table }> = [
  { id: "start", label: "Start", icon: Table },
  { id: "production", label: "Production Breakdown", icon: Calculator },
  { id: "origin", label: "Origin Check", icon: Calculator },
  { id: "ntb", label: "Non-Tariff Barriers", icon: Shield },
  { id: "tariff", label: "Tariff Savings", icon: TrendingDown },
  { id: "checklist", label: "Compliance Checklist", icon: CheckSquare },
];

const NTB_ITEMS = [
  { id: "sps", name: "Phytosanitary / SPS certificate", desc: "Required for agricultural and food products." },
  { id: "coo", name: "Certificate of origin (AfCFTA template)", desc: "Mandatory for preferential treatment." },
  { id: "import-permit", name: "Import permit (if required by destination)", desc: "Check destination country requirements." },
  { id: "customs", name: "Customs declaration", desc: "Must be filed with correct HS code." },
  { id: "standards", name: "Technical / quality standards", desc: "Meet destination market standards." },
];

const DEFAULT_CHECKLIST_ITEMS = [
  "Certificate of origin (AfCFTA) completed",
  "Commercial invoice and packing list",
  "Bill of materials / sourcing documentation",
  "Phytosanitary or SPS certificate (if applicable)",
  "Import permit (if required)",
  "Customs declaration filed",
];

interface ProductionRow {
  id: string;
  description: string;
  afcftaCost: string;
  nonAfcftaCost: string;
  fileName: string;
}

function getFilteredCountries(continent: string): string[] {
  if (!continent) return [];
  return COUNTRIES_BY_CONTINENT[continent] || [];
}

export default function ComplianceCheckPage() {
  const [activeStep, setActiveStep] = useState<StepId>("start");
  const [hsCode, setHsCode] = useState("");
  const [productName, setProductName] = useState("");
  const [originContinent, setOriginContinent] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [destContinent, setDestContinent] = useState("");
  const [destCountry, setDestCountry] = useState("");
  const [productionRows, setProductionRows] = useState<ProductionRow[]>([
    { id: "1", description: "", afcftaCost: "", nonAfcftaCost: "", fileName: "" },
  ]);
  const [checklistProgress, setChecklistProgress] = useState<Record<string, boolean>>({});
  const [hsLookupStatus, setHsLookupStatus] = useState<"idle" | "loading" | "found" | "not-found" | "error">("idle");

  const stepIndex = STEPS.findIndex((s) => s.id === activeStep);
  const progressPercent = ((stepIndex + 1) / STEPS.length) * 100;

  const addProductionRow = () => {
    setProductionRows((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        description: "",
        afcftaCost: "",
        nonAfcftaCost: "",
        fileName: "",
      },
    ]);
  };

  const removeProductionRow = (id: string) => {
    if (productionRows.length <= 1) return;
    setProductionRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateProductionRow = (id: string, field: keyof ProductionRow, value: string) => {
    setProductionRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const totalAfcfta = productionRows.reduce(
    (sum, r) => sum + (parseFloat(r.afcftaCost) || 0),
    0
  );
  const totalNonAfcfta = productionRows.reduce(
    (sum, r) => sum + (parseFloat(r.nonAfcftaCost) || 0),
    0
  );
  const totalCost = totalAfcfta + totalNonAfcfta;
  const rvcPercent = totalCost > 0 ? (totalAfcfta / totalCost) * 100 : 0;
  const rvcMeetsThreshold = rvcPercent >= RVC_THRESHOLD;

  const mockMfnRate = 10;
  const mockAfcftaRate = 0;
  const mockProductValue = totalCost || 10000;
  const dutySaved = (mockProductValue * mockMfnRate) / 100;
  const yearsTo2035 = Math.max(0, 2035 - new Date().getFullYear());
  const projectedSavingsTo2035 = dutySaved * Math.min(yearsTo2035, 10);

  const checklistItems = DEFAULT_CHECKLIST_ITEMS;
  const checklistCompleted = checklistItems.filter((_, i) => checklistProgress[`doc-${i}`]).length;
  const checklistTotal = checklistItems.length;
  const checklistPercent = checklistTotal > 0 ? (checklistCompleted / checklistTotal) * 100 : 0;

  const toggleChecklist = (key: string) => {
    setChecklistProgress((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const goNext = () => {
    const next = Math.min(STEPS.length - 1, stepIndex + 1);
    setActiveStep(STEPS[next].id);
  };

  const goPrev = () => {
    const prev = Math.max(0, stepIndex - 1);
    setActiveStep(STEPS[prev].id);
  };

  const lookupProductByHsCode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      setHsLookupStatus("loading");
      const params = new URLSearchParams();
      params.set("hsCode", trimmed);
      params.set("limit", "1");
      const res = await fetch(`/api/afcfta/tariff-schedule?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setHsLookupStatus("error");
        return;
      }
      const json = await res.json();
      const row = Array.isArray(json.data) ? json.data[0] : null;
      if (row && row.product_description) {
        setProductName(row.product_description);
        setHsLookupStatus("found");
      } else {
        setHsLookupStatus("not-found");
      }
    } catch (err) {
      console.error("HS lookup failed", err);
      setHsLookupStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/20 via-background to-background">
      <div className="sticky top-0 z-50 border-b border-border bg-gradient-to-r from-[#1a1a1a] via-[#2d2d2d] to-[#1a1a1a] shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#c99d2e] text-[#1a1a1a] font-bold text-lg">
              🌍
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AfCFTA Compliance Tool</h1>
              <p className="text-xs text-white/70">HS code → Production → Origin → NTB → Tariff → Checklist</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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
                const isCompleted = idx < stepIndex;
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
                      className={`mt-2 text-xs font-semibold text-center max-w-[4rem] ${
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

        <div className="space-y-6">
          {/* Step 1: Start */}
          {activeStep === "start" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-card p-6 shadow-md">
                <div className="mb-6 flex items-center gap-4 border-b border-border pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#c99d2e]">
                    <Table className="h-6 w-6 text-[#1a1a1a]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Start</h2>
                    <p className="text-sm text-muted-foreground">
                      Enter your HS code, product, and trade countries
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
                        onChange={(e) => {
                          setHsCode(e.target.value);
                          setHsLookupStatus("idle");
                        }}
                        onBlur={() => lookupProductByHsCode(hsCode)}
                        placeholder="e.g. 0101.21"
                        className="w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                      />
                      {hsLookupStatus === "loading" && (
                        <p className="mt-1 text-xs text-muted-foreground">Looking up product…</p>
                      )}
                      {hsLookupStatus === "found" && (
                        <p className="mt-1 text-xs text-green-700 dark:text-green-400">
                          Product loaded from AfCFTA tariff schedule.
                        </p>
                      )}
                      {hsLookupStatus === "not-found" && (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                          No tariff data found for this HS code yet.
                        </p>
                      )}
                      {hsLookupStatus === "error" && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          Could not look up this HS code right now.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Product</label>
                      <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="e.g. Roasted coffee"
                        className="w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Origin continent / country</label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={originContinent}
                          onChange={(e) => {
                            setOriginContinent(e.target.value);
                            setOriginCountry("");
                          }}
                          className="rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none"
                        >
                          <option value="">Continent</option>
                          {CONTINENTS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <select
                          value={originCountry}
                          onChange={(e) => setOriginCountry(e.target.value)}
                          disabled={!originContinent}
                          className="rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none disabled:opacity-50"
                        >
                          <option value="">Country</option>
                          {getFilteredCountries(originContinent).map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold">Destination continent / country</label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={destContinent}
                          onChange={(e) => {
                            setDestContinent(e.target.value);
                            setDestCountry("");
                          }}
                          className="rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none"
                        >
                          <option value="">Continent</option>
                          {CONTINENTS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <select
                          value={destCountry}
                          onChange={(e) => setDestCountry(e.target.value)}
                          disabled={!destContinent}
                          className="rounded-lg border-2 border-input bg-background px-4 py-3 text-sm focus:border-[#D4AF37] focus:outline-none disabled:opacity-50"
                        >
                          <option value="">Country</option>
                          {getFilteredCountries(destContinent).map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  {(hsCode || productName || originCountry || destCountry) && (
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <h3 className="mb-2 font-semibold">Trade summary</h3>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {hsCode && <li>HS: {hsCode}</li>}
                        {productName && <li>Product: {productName}</li>}
                        {(originCountry || destCountry) && (
                          <li>Route: {originCountry || "—"} → {destCountry || "—"}</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Production Breakdown */}
          {activeStep === "production" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-card p-6 shadow-md">
                <div className="mb-6 flex items-center gap-4 border-b border-border pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#c99d2e]">
                    <Calculator className="h-6 w-6 text-[#1a1a1a]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Production Breakdown</h2>
                    <p className="text-sm text-muted-foreground">
                      Input costs with AfCFTA / non-AfCFTA sourcing and invoice uploads
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left p-3 font-semibold">Description</th>
                        <th className="text-right p-3 font-semibold">AfCFTA cost (USD)</th>
                        <th className="text-right p-3 font-semibold">Non-AfCFTA cost (USD)</th>
                        <th className="text-left p-3 font-semibold">Invoice / upload</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {productionRows.map((row) => (
                        <tr key={row.id} className="border-b border-border/60">
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.description}
                              onChange={(e) => updateProductionRow(row.id, "description", e.target.value)}
                              placeholder="e.g. Raw materials"
                              className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:border-[#D4AF37] focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={row.afcftaCost}
                              onChange={(e) => updateProductionRow(row.id, "afcftaCost", e.target.value)}
                              placeholder="0"
                              className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-right focus:border-[#D4AF37] focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={row.nonAfcftaCost}
                              onChange={(e) => updateProductionRow(row.id, "nonAfcftaCost", e.target.value)}
                              placeholder="0"
                              className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-right focus:border-[#D4AF37] focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                              <Upload className="h-4 w-4" />
                              <span className="truncate max-w-[8rem]">{row.fileName || "Upload"}</span>
                              <input
                                type="file"
                                className="sr-only"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) updateProductionRow(row.id, "fileName", f.name);
                                }}
                              />
                            </label>
                          </td>
                          <td className="p-2">
                            <button
                              type="button"
                              onClick={() => removeProductionRow(row.id)}
                              disabled={productionRows.length <= 1}
                              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:pointer-events-none"
                              aria-label="Remove row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={addProductionRow}
                  className="mt-4 flex items-center gap-2 rounded-lg border-2 border-dashed border-[#D4AF37]/50 bg-[#D4AF37]/5 px-4 py-2 text-sm font-medium text-[#c99d2e] hover:bg-[#D4AF37]/10"
                >
                  <Plus className="h-4 w-4" />
                  Add row
                </button>
                {totalCost > 0 && (
                  <div className="mt-4 flex gap-4 text-sm">
                    <span>Total AfCFTA: <strong>${totalAfcfta.toLocaleString()}</strong></span>
                    <span>Total non-AfCFTA: <strong>${totalNonAfcfta.toLocaleString()}</strong></span>
                    <span>Total: <strong>${totalCost.toLocaleString()}</strong></span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Origin Check */}
          {activeStep === "origin" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-card p-6 shadow-md">
                <div className="mb-6 flex items-center gap-4 border-b border-border pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#c99d2e]">
                    <Calculator className="h-6 w-6 text-[#1a1a1a]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Origin Check</h2>
                    <p className="text-sm text-muted-foreground">
                      See if your RVC meets the {RVC_THRESHOLD}% threshold
                    </p>
                  </div>
                </div>
                <div className="max-w-md space-y-4">
                  <div className="rounded-lg bg-muted/50 p-4">
                    <div className="text-sm text-muted-foreground">Regional value content (RVC)</div>
                    <div className="text-2xl font-bold">
                      {totalCost > 0 ? rvcPercent.toFixed(1) : "—"}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      AfCFTA-sourced cost ÷ total cost × 100. Threshold: {RVC_THRESHOLD}%.
                    </div>
                  </div>
                  <div
                    className={`rounded-lg border-l-4 p-4 ${
                      rvcMeetsThreshold
                        ? "border-green-500 bg-green-500/10"
                        : "border-amber-500 bg-amber-500/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {rvcMeetsThreshold ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                      <div>
                        <p className="font-semibold">
                          {rvcMeetsThreshold
                            ? "Your product meets the RVC threshold"
                            : "Your product does not yet meet the RVC threshold"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {rvcMeetsThreshold
                            ? "You may qualify for AfCFTA preferential treatment on origin."
                            : "Increase AfCFTA-sourced inputs or reduce non-AfCFTA costs to reach 40%."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Non-Tariff Barriers */}
          {activeStep === "ntb" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-card p-6 shadow-md">
                <div className="mb-6 flex items-center gap-4 border-b border-border pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#c99d2e]">
                    <Shield className="h-6 w-6 text-[#1a1a1a]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Non-Tariff Barriers</h2>
                    <p className="text-sm text-muted-foreground">
                      Review certifications needed (e.g. phytosanitary)
                    </p>
                  </div>
                </div>
                <ul className="space-y-4">
                  {NTB_ITEMS.map((item) => (
                    <li
                      key={item.id}
                      className="flex gap-4 rounded-lg border border-border bg-muted/20 p-4"
                    >
                      <FileCheck className="h-5 w-5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-sm text-muted-foreground">{item.desc}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Step 5: Tariff Savings */}
          {activeStep === "tariff" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-card p-6 shadow-md">
                <div className="mb-6 flex items-center gap-4 border-b border-border pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#c99d2e]">
                    <TrendingDown className="h-6 w-6 text-[#1a1a1a]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Tariff Savings</h2>
                    <p className="text-sm text-muted-foreground">
                      Calculate your savings up to 2035 (0% rate)
                    </p>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex justify-between rounded-lg bg-muted/50 p-4">
                      <span className="text-muted-foreground">MFN rate</span>
                      <span className="font-bold">{mockMfnRate}%</span>
                    </div>
                    <div className="flex justify-between rounded-lg bg-green-500/10 p-4">
                      <span className="text-green-700 dark:text-green-400">AfCFTA rate (to 2035)</span>
                      <span className="font-bold text-green-700 dark:text-green-400">{mockAfcftaRate}%</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-gradient-to-r from-[#2d5016] to-[#3a6a1d] p-6 text-white text-center">
                    <div className="text-sm uppercase tracking-wider opacity-90">Duty saved per shipment</div>
                    <div className="mt-2 text-3xl font-bold">
                      ${dutySaved.toLocaleString()}
                    </div>
                    <div className="mt-2 text-sm opacity-80">
                      Projected savings to 2035: ${projectedSavingsTo2035.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Compliance Checklist */}
          {activeStep === "checklist" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border-l-4 border-l-[#D4AF37] bg-card p-6 shadow-md">
                <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#c99d2e]">
                      <CheckSquare className="h-6 w-6 text-[#1a1a1a]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Compliance Checklist</h2>
                      <p className="text-sm text-muted-foreground">
                        Track required documents with clickable checkboxes
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[#2d5016]">
                      {checklistCompleted}/{checklistTotal}
                    </div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                </div>
                {checklistTotal > 0 && (
                  <div className="mb-4">
                    <div className="mb-2 flex justify-between text-sm">
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
                <ul className="space-y-3">
                  {checklistItems.map((item, i) => {
                    const key = `doc-${i}`;
                    const checked = checklistProgress[key];
                    return (
                      <li
                        key={key}
                        className="flex items-center gap-4 rounded-lg bg-muted/30 p-4 hover:bg-muted/50"
                      >
                        <button
                          type="button"
                          onClick={() => toggleChecklist(key)}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-all ${
                            checked
                              ? "border-[#D4AF37] bg-[#D4AF37] text-[#1a1a1a]"
                              : "border-input bg-background"
                          }`}
                          aria-pressed={checked}
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
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <button
              type="button"
              onClick={goPrev}
              disabled={stepIndex === 0}
              className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={stepIndex === STEPS.length - 1}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-4 py-2 text-sm font-semibold text-[#1a1a1a] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-lg"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
