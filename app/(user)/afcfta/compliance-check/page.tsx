"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  CheckSquare,
  Calculator,
  Table,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Upload,
  ChevronRight,
  ChevronLeft,
  Shield,
  TrendingDown,
  FileCheck,
  Paperclip,
  X,
  Download,
  RotateCcw,
} from "lucide-react";
import { InfoIcon } from "@/components/ui/InfoIcon";
import { buildAfCFTAReportPdf, loadImageAsDataUrl } from "@/lib/afcfta-report-pdf";

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

const AFCFTA_COUNTRIES = COUNTRIES_BY_CONTINENT.Africa;

/* Organization palette: primary #c18c43, accent #603b1c, muted #e3ba65 */
const ORG_ACCENT = "#603b1c";
const ORG_PRIMARY = "#c18c43";

type StepId = "start" | "production" | "origin" | "ntb" | "tariff" | "checklist";

const STEPS: Array<{ id: StepId; label: string; icon: typeof Table }> = [
  { id: "start", label: "Start", icon: Table },
  { id: "production", label: "Production", icon: Calculator },
  { id: "origin", label: "Origin Check", icon: Calculator },
  { id: "ntb", label: "Barriers", icon: Shield },
  { id: "tariff", label: "Savings", icon: TrendingDown },
  { id: "checklist", label: "Checklist", icon: CheckSquare },
];

/** Tariff row from API for Savings step (by country + HS code) */
type SavingsTariffRow = {
  mfn_rate_percent: number | null;
  afcfta_2026_percent: number | null;
  afcfta_2030_percent: number | null;
  afcfta_2035_percent: number | null;
};

/** Barrier check item: type drives colour/icon; text can use {destCountry} and {originCountry} placeholders */
type BarrierItem = {
  id: string;
  type: "required" | "compliant" | "optional";
  title: string;
  description: string;
  howToGet?: string;
};

/** Returns barrier checks specific to exporting from originCountry to destCountry. */
function getBarriersForDestination(destCountry: string, originCountry: string): BarrierItem[] {
  const dest = destCountry.trim() || "your destination";
  const origin = originCountry.trim() || "your country";

  const barriers: BarrierItem[] = [
    {
      id: "sps",
      type: "required",
      title: "Phytosanitary / SPS certificate",
      description: `Agricultural and food products need health certification for export to ${dest}.`,
      howToGet: `Contact the Plant Protection Service (or equivalent) in ${origin}. Time: 3–5 business days | Cost: typically $50–150.`,
    },
    {
      id: "coo",
      type: "required",
      title: "Certificate of origin (AfCFTA template)",
      description: `Mandatory for preferential tariff treatment when exporting to ${dest}.`,
      howToGet: `Obtain from your chamber of commerce or designated authority in ${origin}. Use the AfCFTA template.`,
    },
    {
      id: "import-permit",
      type: "optional",
      title: "Import permit (if required by destination)",
      description: `${dest} may require an import permit or licence for certain products. Check the destination country's trade authority.`,
      howToGet: `Apply via the relevant ministry or agency in ${dest} (importer applies). Allow 1–4 weeks.`,
    },
    {
      id: "customs",
      type: "required",
      title: "Customs declaration",
      description: `Must be filed with the correct HS code for clearance in ${dest}.`,
      howToGet: `Submit through your customs broker or ${dest} customs portal. Required for all shipments.`,
    },
    {
      id: "standards",
      type: "compliant",
      title: "Product standards – compliant",
      description: "Your product meets AfCFTA quality standards. No additional testing needed for this category.",
    },
  ];

  return barriers;
}

/** Checklist section: title uses {origin} / {dest} placeholders; items have optional subLabel */
type ChecklistSection = {
  id: string;
  titleKey: "before_export" | "afcfta_docs" | "at_import";
  items: { id: string; title: string; subLabel?: string }[];
};

const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    id: "before-export",
    titleKey: "before_export",
    items: [
      { id: "registration", title: "Business Registration Certificate", subLabel: "Valid until Dec 2026" },
      { id: "phytosanitary", title: "Phytosanitary Certificate", subLabel: "From Plant Protection Service (3-5 days)" },
    ],
  },
  {
    id: "afcfta-docs",
    titleKey: "afcfta_docs",
    items: [
      { id: "coo-application", title: "Certificate of Origin Application", subLabel: "Submit to authorized agency" },
      { id: "production-costs", title: "Production Cost Records", subLabel: "Keep invoices and receipts for 5 years" },
    ],
  },
  {
    id: "at-import",
    titleKey: "at_import",
    items: [
      { id: "commercial-invoice", title: "Commercial Invoice", subLabel: "With HS code and AfCFTA claim" },
      { id: "customs-declaration", title: "Customs Declaration", subLabel: "Filed at port of entry" },
    ],
  },
];

interface ProductionRow {
  id: string;
  description: string;
  sourceCountry: string;
  cost: string;
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
    { id: "1", description: "", sourceCountry: "", cost: "", fileName: "" },
  ]);
  const [checklistProgress, setChecklistProgress] = useState<Record<string, boolean>>({});
  const [hsLookupStatus, setHsLookupStatus] = useState<"idle" | "loading" | "found" | "not-found" | "error">("idle");
  const [shipmentValue, setShipmentValue] = useState("");
  const [savingsTariffRow, setSavingsTariffRow] = useState<SavingsTariffRow | null>(null);
  const [savingsTariffStatus, setSavingsTariffStatus] = useState<"idle" | "loading" | "found" | "not-found" | "error">("idle");
  const [reportUsage, setReportUsage] = useState<{
    canDownload: boolean;
    limit: number | null;
    used: number;
    remaining: number | null;
    payAsYouGoCount: number;
  } | null>(null);
  const [reportDownloadStatus, setReportDownloadStatus] = useState<"idle" | "loading" | "error">("idle");
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    if (activeStep !== "tariff" || !hsCode.trim() || !destCountry) {
      setSavingsTariffRow(null);
      setSavingsTariffStatus("idle");
      return;
    }
    let cancelled = false;
    setSavingsTariffStatus("loading");
    const params = new URLSearchParams();
    params.set("hsCode", hsCode.trim());
    params.set("country", destCountry);
    params.set("limit", "1");
    fetch(`/api/afcfta/tariff-schedule?${params.toString()}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Fetch failed");
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const row = Array.isArray(json.data) ? json.data[0] : null;
        if (row) {
          setSavingsTariffRow({
            mfn_rate_percent: row.mfn_rate_percent ?? null,
            afcfta_2026_percent: row.afcfta_2026_percent ?? null,
            afcfta_2030_percent: row.afcfta_2030_percent ?? null,
            afcfta_2035_percent: row.afcfta_2035_percent ?? null,
          });
          setSavingsTariffStatus("found");
        } else {
          setSavingsTariffRow(null);
          setSavingsTariffStatus("not-found");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Savings tariff fetch failed", err);
          setSavingsTariffRow(null);
          setSavingsTariffStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeStep, hsCode, destCountry]);

  useEffect(() => {
    if (activeStep !== "checklist") return;
    fetch("/api/afcfta/report/usage", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load"))))
      .then((data: { canDownload?: boolean; limit?: number | null; used?: number; remaining?: number | null; payAsYouGoCount?: number }) => {
        setReportUsage({
          canDownload: data.canDownload ?? false,
          limit: data.limit ?? null,
          used: data.used ?? 0,
          remaining: data.remaining ?? null,
          payAsYouGoCount: data.payAsYouGoCount ?? 0,
        });
      })
      .catch(() => setReportUsage(null));
  }, [activeStep]);

  const stepIndex = STEPS.findIndex((s) => s.id === activeStep);
  const progressPercent = ((stepIndex + 1) / STEPS.length) * 100;

  const isStartValid =
    Boolean(hsCode.trim()) &&
    Boolean(productName.trim()) &&
    Boolean(originCountry) &&
    Boolean(destCountry);

  const addProductionRow = () => {
    setProductionRows((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        description: "",
        sourceCountry: "",
        cost: "",
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

  const totalCost = productionRows.reduce(
    (sum, r) => sum + (parseFloat(r.cost) || 0),
    0
  );
  const totalAfcfta = productionRows.reduce(
    (sum, r) =>
      AFCFTA_COUNTRIES.includes(r.sourceCountry) ? sum + (parseFloat(r.cost) || 0) : sum,
    0
  );
  const rvcPercent = totalCost > 0 ? (totalAfcfta / totalCost) * 100 : 0;
  const rvcMeetsThreshold = rvcPercent >= RVC_THRESHOLD;

  const mockMfnRate = 10;
  const mockAfcftaRate = 0;
  const mockProductValue = totalCost || 10000;
  const dutySaved = (mockProductValue * mockMfnRate) / 100;
  const yearsTo2035 = Math.max(0, 2035 - new Date().getFullYear());
  const projectedSavingsTo2035 = dutySaved * Math.min(yearsTo2035, 10);

  /* Savings step: rates from tariff schedule (by destination country + HS code) or fallback */
  const savingsMfnRate = savingsTariffRow?.mfn_rate_percent ?? null;
  const savingsAfcfta2026 = savingsTariffRow?.afcfta_2026_percent ?? null;
  const savingsAfcfta2030 = savingsTariffRow?.afcfta_2030_percent ?? null;
  const savingsAfcfta2035 = savingsTariffRow?.afcfta_2035_percent ?? null;
  const mfnNum = savingsMfnRate != null ? savingsMfnRate : 0;
  const totalSavingsBy2035 =
    mfnNum !== 0 && savingsAfcfta2035 != null ? mfnNum - savingsAfcfta2035 : null;

  const currentYear = new Date().getFullYear();
  const applicablePhaseYear =
    currentYear < 2026 ? 2026 : currentYear < 2030 ? 2026 : currentYear < 2035 ? 2030 : 2035;
  const applicableAfcftaRate =
    applicablePhaseYear === 2026
      ? savingsAfcfta2026
      : applicablePhaseYear === 2030
        ? savingsAfcfta2030
        : savingsAfcfta2035;
  const savingsRateForCurrentYear =
    mfnNum !== 0 && applicableAfcftaRate != null ? mfnNum - applicableAfcftaRate : null;
  const shipmentNum = parseFloat(shipmentValue.replace(/,/g, "")) || 0;
  const estimatedAnnualSavingsForCurrentYear =
    savingsRateForCurrentYear != null
      ? (shipmentNum * savingsRateForCurrentYear) / 100
      : 0;

  const checklistFlatItems = CHECKLIST_SECTIONS.flatMap((sec) =>
    sec.items.map((item) => ({ sectionId: sec.id, sectionTitleKey: sec.titleKey, itemId: item.id, title: item.title, subLabel: item.subLabel, key: `${sec.id}-${item.id}` }))
  );
  const checklistTotal = checklistFlatItems.length;
  const checklistCompleted = checklistFlatItems.filter(({ key }) => checklistProgress[key]).length;
  const checklistPercent = checklistTotal > 0 ? (checklistCompleted / checklistTotal) * 100 : 0;

  const getChecklistSectionTitle = (key: "before_export" | "afcfta_docs" | "at_import") => {
    if (key === "before_export") return `Before Export (in ${originCountry || "your country"})`;
    if (key === "at_import") return `At Import (in ${destCountry || "destination"})`;
    return "AfCFTA Documentation";
  };

  const toggleChecklist = (key: string) => {
    setChecklistProgress((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetJourney = () => {
    if (typeof window !== "undefined" && !window.confirm("Reset the compliance journey? All your inputs will be cleared and you will start from the beginning.")) return;
    setActiveStep("start");
    setHsCode("");
    setProductName("");
    setOriginContinent("");
    setOriginCountry("");
    setDestContinent("");
    setDestCountry("");
    setProductionRows([{ id: "1", description: "", sourceCountry: "", cost: "", fileName: "" }]);
    setChecklistProgress({});
    setHsLookupStatus("idle");
    setShipmentValue("");
    setSavingsTariffRow(null);
    setSavingsTariffStatus("idle");
    setReportUsage(null);
    setReportDownloadStatus("idle");
    setReportError(null);
  };

  const handleDownloadReport = async () => {
    setReportDownloadStatus("loading");
    setReportError(null);
    try {
      const res = await fetch("/api/afcfta/report/consume", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportError(data.error === "limit_reached" ? "Report limit reached for your plan. Upgrade or purchase a report to download." : "Could not download report.");
        setReportDownloadStatus("error");
        fetch("/api/afcfta/report/usage", { credentials: "include" })
          .then((r) => r.ok && r.json())
          .then((u: { canDownload?: boolean; limit?: number | null; used?: number; remaining?: number | null; payAsYouGoCount?: number }) => {
            if (u) setReportUsage({ canDownload: u.canDownload ?? false, limit: u.limit ?? null, used: u.used ?? 0, remaining: u.remaining ?? null, payAsYouGoCount: u.payAsYouGoCount ?? 0 });
          })
          .catch(() => {});
        return;
      }
      let logoDataUrl: string | null = null;
      try {
        const settingsRes = await fetch("/api/admin/platform-settings", { credentials: "include" });
        const settings = await settingsRes.json().catch(() => ({}));
        if (settings?.logoUrl) {
          logoDataUrl = await loadImageAsDataUrl(settings.logoUrl);
        }
      } catch {
        // proceed without logo
      }
      const snapshot = {
        productName,
        hsCode,
        originCountry,
        destCountry,
        totalCost,
        rvcPercent,
        rvcMeetsThreshold,
        barriers: getBarriersForDestination(destCountry, originCountry),
        mfnRate: savingsMfnRate,
        afcfta2026: savingsAfcfta2026,
        afcfta2030: savingsAfcfta2030,
        afcfta2035: savingsAfcfta2035,
        totalSavingsBy2035,
        shipmentValue,
        estimatedAnnualSavings: estimatedAnnualSavingsForCurrentYear,
        currentYear,
        checklistSections: CHECKLIST_SECTIONS,
        checklistProgress,
        getSectionTitle: getChecklistSectionTitle,
      };
      const blob = await buildAfCFTAReportPdf(snapshot, logoDataUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `afcfta-compliance-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setReportDownloadStatus("idle");
      fetch("/api/afcfta/report/usage", { credentials: "include" })
        .then((r) => r.ok && r.json())
        .then((u: { canDownload?: boolean; limit?: number | null; used?: number; remaining?: number | null; payAsYouGoCount?: number }) => {
          if (u) setReportUsage({ canDownload: u.canDownload ?? false, limit: u.limit ?? null, used: u.used ?? 0, remaining: u.remaining ?? null, payAsYouGoCount: u.payAsYouGoCount ?? 0 });
        })
        .catch(() => {});
    } catch {
      setReportError("Download failed. Try again.");
      setReportDownloadStatus("error");
    }
  };

  const goNext = () => {
    if (activeStep === "start" && !isStartValid) return;
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#c99d2e] text-[#1a1a1a] font-bold text-lg">
                🌍
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">AfCFTA Compliance Tool</h1>
                <p className="text-xs text-white/70">HS code → Production → Origin → NTB → Tariff → Checklist</p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetJourney}
              className="flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              title="Clear all inputs and start from the beginning"
            >
              <RotateCcw className="h-4 w-4" />
              Reset journey
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-lg">
          <div className="relative mb-6">
            <div className="absolute top-5 left-0 right-0 h-1 bg-muted" />
            <div
              className="absolute top-5 left-0 h-1 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%`, background: `linear-gradient(90deg, ${ORG_PRIMARY}, ${ORG_ACCENT})` }}
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
                    onClick={() => {
                      if (activeStep === "start" && idx > 0 && !isStartValid) return;
                      setActiveStep(step.id);
                    }}
                    className="flex flex-col items-center flex-1 group"
                  >
                    <div
                      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                        isCompleted
                          ? "border-[var(--primary)] bg-[var(--primary)] text-primary-foreground"
                          : isActive
                            ? "text-white scale-110"
                            : "border-muted bg-background text-muted-foreground"
                      }`}
                      style={isActive ? { borderColor: ORG_ACCENT, backgroundColor: ORG_ACCENT } : undefined}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-5 w-5" />
                      )}
                    </div>
                    <span
                      className={`mt-2 text-xs font-semibold text-center max-w-[4rem] ${
                        isActive ? "" : isCompleted ? "text-foreground" : "text-muted-foreground"
                      }`}
                      style={isActive ? { color: ORG_ACCENT } : undefined}
                    >
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Product / trade summary bar (golden banner) when not on Start */}
        {activeStep !== "start" && (hsCode || productName || originCountry || destCountry) && (
          <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-5 py-3 shadow-md border border-border/50" style={{ background: `linear-gradient(135deg, ${ORG_PRIMARY}44, ${ORG_PRIMARY}22 50%, var(--muted) 100%)` }}>
            {productName && (
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">Product:</span> <span className="font-bold text-foreground">{productName}</span>
              </span>
            )}
            {hsCode && (
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">HS Code:</span> <span className="font-bold text-foreground">{hsCode}</span>
              </span>
            )}
            {originCountry && (
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">From:</span> <span className="font-bold text-foreground">{originCountry}</span>
              </span>
            )}
            {destCountry && (
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">To:</span> <span className="font-bold text-foreground">{destCountry}</span>
              </span>
            )}
          </div>
        )}

        <div className="space-y-6">
          {/* Step 1: Start Your Compliance Check */}
          {activeStep === "start" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border border-border bg-card p-6 shadow-md">
                <h2 className="text-2xl font-bold text-foreground">Start Your Compliance Check</h2>
                <div className="mt-4 rounded-lg border-l-4 border-l-amber-400 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  Welcome! Let&apos;s check if your product qualifies for{" "}
                  <span className="inline-flex items-center align-middle">
                    <InfoIcon content="Preferential (lower or zero) tariffs under the AfCFTA agreement when your product meets rules of origin and other requirements." />
                  </span>{" "}
                  <strong className="text-foreground">AfCFTA preferential tariffs</strong>. This should take about 5 minutes.
                </div>

                <div className="mt-6 space-y-5">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      HS Code
                      <InfoIcon content="Harmonized System code: international product classification used for customs and tariffs (e.g. 0101.21 for live horses)." />
                      <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={hsCode}
                      onChange={(e) => {
                        setHsCode(e.target.value);
                        setHsLookupStatus("idle");
                        setProductName("");
                      }}
                      onBlur={() => lookupProductByHsCode(hsCode)}
                      placeholder="e.g. 012222"
                      className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Enter the 6-digit code for your product</p>
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
                    <label className="mb-1.5 block text-sm font-semibold text-foreground">
                      Product Description <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={productName}
                      placeholder="Enter an HS code above and blur to load from tariff schedule"
                      className="w-full rounded-lg border border-input bg-muted/50 px-4 py-3 text-sm text-foreground cursor-not-allowed focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Filled automatically when the HS code is found in the AfCFTA tariff schedule.</p>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      Exporting From (Country of Origin)
                      <InfoIcon content="The country where your product was produced or where the last substantial transformation took place. This is used for rules of origin and certificates of origin." />
                      <span className="text-destructive">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={originContinent}
                        onChange={(e) => {
                          setOriginContinent(e.target.value);
                          setOriginCountry("");
                        }}
                        className="rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                        className="rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">Country</option>
                        {getFilteredCountries(originContinent).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-foreground">
                      Exporting To (Destination Country) <span className="text-destructive">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={destContinent}
                        onChange={(e) => {
                          setDestContinent(e.target.value);
                          setDestCountry("");
                        }}
                        className="rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                        className="rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">Country</option>
                        {getFilteredCountries(destContinent).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Where are you sending your products?</p>
                  </div>

                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!isStartValid}
                    title={!isStartValid ? "Fill in HS Code, Product Description, Exporting From, and Exporting To to continue" : undefined}
                    className="w-full rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-6 py-3 text-sm font-semibold text-[#1a1a1a] shadow-md transition hover:opacity-95 hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50"
                  >
                    Start Compliance Check
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Production Cost Breakdown */}
          {activeStep === "production" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border border-border bg-card p-6 shadow-md">
                <h2 className="text-2xl font-bold text-foreground">Production Cost Breakdown</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter the costs of making your product. We&apos;ll calculate how much comes from AfCFTA countries. You need at least {RVC_THRESHOLD}% to qualify for preferential tariffs.
                </p>

                {/* What's this for? — light blue box (matches info icon reference) */}
                <div className="mt-6 rounded-xl border border-sky-200/80 bg-sky-50/90 p-4 dark:border-sky-800/40 dark:bg-sky-950/30 shadow-sm">
                  <p className="text-sm text-sky-900 dark:text-sky-100">
                    <span className="font-semibold">What&apos;s this for?</span> To qualify for{" "}
                    <span className="inline-flex items-center gap-0.5">
                      AfCFTA tariff benefits
                      <InfoIcon
                        content="Preferential (lower or zero) tariffs when trading under the AfCFTA agreement, subject to rules of origin."
                      />
                    </span>
                    , at least {RVC_THRESHOLD}% of your production costs must come from AfCFTA member countries.
                  </p>
                </div>

                {/* Upload invoices — yellow box */}
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
                  <p className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100">
                    <Paperclip className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>Upload invoices:</strong> For each input, please upload the supplier invoice (PDF, JPG, or PNG). Our OCR technology will automatically verify the details and help speed up customs clearance.
                    </span>
                  </p>
                </div>

                {/* Input / material table — dark green header like screenshot */}
                <div className="mt-6 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr style={{ backgroundColor: ORG_ACCENT }}>
                        <th className="text-left p-3 font-bold text-white">Input/Material</th>
                        <th className="text-left p-3 font-bold text-white">Source Country</th>
                        <th className="text-right p-3 font-bold text-white">Cost (USD)</th>
                        <th className="text-left p-3 font-bold text-white">Invoice Upload</th>
                        <th className="text-center p-3 font-bold text-white">AfCFTA?</th>
                        <th className="w-24 p-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {productionRows.map((row) => {
                        const isAfcfta = AFCFTA_COUNTRIES.includes(row.sourceCountry);
                        return (
                          <tr key={row.id} className="border-b border-border/60 bg-card">
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.description}
                                onChange={(e) => updateProductionRow(row.id, "description", e.target.value)}
                                placeholder="e.g. Coffee Beans"
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={row.sourceCountry}
                                onChange={(e) => updateProductionRow(row.id, "sourceCountry", e.target.value)}
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
                              >
                                <option value="">Select country</option>
                                {AFCFTA_COUNTRIES.map((c) => (
                                  <option key={c} value={c}>{c} (AfCFTA)</option>
                                ))}
                                {COUNTRIES_BY_CONTINENT.Asia.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                                {COUNTRIES_BY_CONTINENT.Europe.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                                {COUNTRIES_BY_CONTINENT.Americas.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                                {COUNTRIES_BY_CONTINENT.Oceania.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={row.cost}
                                onChange={(e) => updateProductionRow(row.id, "cost", e.target.value)}
                                placeholder="0"
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-right focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
                              />
                            </td>
                            <td className="p-2">
                              <label className="flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground">
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) updateProductionRow(row.id, "fileName", f.name);
                                  }}
                                />
                                <span className="text-sm">Choose File</span>
                                {row.fileName ? (
                                  <>
                                    <span className="truncate max-w-[8rem] text-xs">{row.fileName}</span>
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No file chosen</span>
                                )}
                              </label>
                            </td>
                            <td className="p-2 text-center">
                              {isAfcfta ? (
                                <CheckCircle2 className="mx-auto h-5 w-5 text-green-600 dark:text-green-400" aria-label="AfCFTA eligible" />
                              ) : (
                                <X className="mx-auto h-5 w-5 text-gray-400 dark:text-gray-500" aria-label="Not AfCFTA" strokeWidth={2.5} />
                              )}
                            </td>
                            <td className="p-2">
                              <button
                                type="button"
                                onClick={() => removeProductionRow(row.id)}
                                disabled={productionRows.length <= 1}
                                className="rounded bg-destructive/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-destructive disabled:opacity-30 disabled:pointer-events-none"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={addProductionRow}
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
                  style={{ backgroundColor: ORG_ACCENT }}
                >
                  <Plus className="h-4 w-4" />
                  Add Another Input
                </button>

                {/* Cost summary */}
                <div className="mt-6 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Production Cost:</span>
                    <span className="font-semibold">${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      AfCFTA Content:
                      <InfoIcon
                        content="Sum of costs from inputs sourced in AfCFTA member countries. Used to calculate Regional Value Content (RVC)."
                      />
                    </span>
                    <span className="font-semibold">${totalAfcfta.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      Regional Value Content (RVC):
                      <InfoIcon
                        content="AfCFTA content ÷ total cost × 100%. You need at least 40% RVC to qualify for AfCFTA preferential tariffs."
                      />
                    </span>
                    <span className={`font-bold ${rvcMeetsThreshold ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
                      {totalCost > 0 ? rvcPercent.toFixed(1) : "0"}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Rules of Origin Check */}
          {activeStep === "origin" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border border-border bg-card p-6 shadow-md">
                <h2 className="text-2xl font-bold text-foreground">Rules of Origin Check</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Let&apos;s see if your product qualifies for AfCFTA preferential tariffs based on where it&apos;s made.
                </p>

                {/* Outcome message — Good News / Notice */}
                <div
                  className={`mt-6 rounded-xl border p-4 ${
                    rvcMeetsThreshold
                      ? "border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-950/30"
                      : "border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30"
                  }`}
                >
                  {rvcMeetsThreshold ? (
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      <span className="font-bold">Good News!</span> Your product qualifies for AfCFTA preferential tariffs. Your Regional Value Content (RVC) is <strong>{totalCost > 0 ? rvcPercent.toFixed(1) : "0"}%</strong>, which meets the required {RVC_THRESHOLD}%.
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Your product does not yet meet the RVC threshold. Your Regional Value Content (RVC) is <strong>{totalCost > 0 ? rvcPercent.toFixed(1) : "0"}%</strong>; you need at least {RVC_THRESHOLD}%. Increase AfCFTA-sourced inputs to qualify.
                    </p>
                  )}
                </div>

                {/* What this means */}
                <h3 className="mt-6 text-sm font-semibold text-foreground">What this means:</h3>
                <ul className="mt-3 space-y-3">
                  {rvcMeetsThreshold && destCountry && (
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
                      <span className="text-sm text-foreground">
                        You can claim reduced tariffs when exporting to {destCountry}
                      </span>
                    </li>
                  )}
                  {rvcMeetsThreshold && (
                    <li className="flex items-start gap-3">
                      <FileText className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                      <span className="text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                        You&apos;ll need a Certificate of Origin
                        <InfoIcon content="Official document proving your product meets AfCFTA rules of origin. Required by customs for preferential tariff treatment. Use the AfCFTA template." />
                      </span>
                    </li>
                  )}
                  <li className="flex items-start gap-3">
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                    <span className="text-sm text-foreground">
                      Keep records of your production costs for at least 5 years
                    </span>
                  </li>
                </ul>

                {!rvcMeetsThreshold && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    AfCFTA-sourced cost ÷ total cost × 100 = RVC. Threshold: {RVC_THRESHOLD}%. Go back to Production to adjust inputs.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Non-Tariff Barrier Check — destination-specific */}
          {activeStep === "ntb" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border border-border bg-card p-6 shadow-md">
                <h2 className="text-2xl font-bold text-foreground">Non-Tariff Barrier Check</h2>
                <div className="mt-2 rounded-lg border-l-4 border-l-amber-400 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  Checking for other requirements or restrictions beyond tariffs that could affect your shipment{destCountry ? ` to ${destCountry}` : ""}.
                </div>

                <div className="mt-6 rounded-xl border border-sky-200/80 bg-sky-50/90 p-4 dark:border-sky-800/40 dark:bg-sky-950/30 shadow-sm">
                  <p className="text-sm text-sky-900 dark:text-sky-100">
                    What are <span className="inline-flex items-center align-middle"><InfoIcon content="Non-tariff barriers are rules, procedures, or standards (e.g. licences, SPS certificates, quality standards) that affect trade without being a customs tariff. They must be met for your goods to enter the destination market." /></span> <strong>Non-Tariff Barriers?</strong> These are additional requirements like licences, certificates, or quality standards you need to meet.
                  </p>
                </div>

                {!destCountry ? (
                  <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    Select a <strong>destination country</strong> in the Start step to see requirements specific to your export market. Below is a general checklist.
                  </p>
                ) : (
                  <p className="mt-6 text-sm font-medium text-foreground">
                    Requirements for exporting to <strong>{destCountry}</strong>
                    {originCountry && (
                      <span className="text-muted-foreground font-normal"> (from {originCountry})</span>
                    )}
                  </p>
                )}

                <ul className="mt-4 space-y-4">
                  {getBarriersForDestination(destCountry, originCountry).map((item) => (
                    <li
                      key={item.id}
                      className={`rounded-lg border px-4 py-4 ${
                        item.type === "required"
                          ? "border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20"
                          : item.type === "compliant"
                            ? "border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20"
                            : "border-l-4 border-l-amber-400 bg-muted/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {item.type === "required" && (
                          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        )}
                        {item.type === "compliant" && (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
                        )}
                        {item.type === "optional" && (
                          <FileText className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground">{item.title}</div>
                          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                          {item.howToGet && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">How to get it:</span> {item.howToGet}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Step 5: Your Tariff Savings (rates from tariff schedule by destination country + HS code) */}
          {activeStep === "tariff" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border border-border bg-card p-6 shadow-md">
                <h2 className="text-2xl font-bold text-foreground">Your Tariff Savings</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Here&apos;s how much you can save on tariffs over time with AfCFTA preferential rates.
                </p>

                {savingsTariffStatus === "loading" && (
                  <p className="mt-4 text-sm text-muted-foreground">Loading tariff rates for your product and destination…</p>
                )}
                {savingsTariffStatus === "not-found" && (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    No tariff schedule found for this HS code and destination country. Complete the Start step with an HS code and &quot;Exporting To&quot; that exist in the tariff schedule.
                  </p>
                )}
                {savingsTariffStatus === "error" && (
                  <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                    Could not load tariff rates. Try again later.
                  </p>
                )}

                {(savingsTariffStatus === "found" || savingsTariffStatus === "idle") && (
                  <>
                    <div className="mt-6 space-y-2">
                      <div className="flex items-center justify-between rounded-lg bg-green-100 dark:bg-green-950/40 px-4 py-3">
                        <span className="flex items-center gap-1.5 text-sm text-foreground">
                          Standard MFN Tariff
                          <InfoIcon content="Most Favoured Nation rate: the standard tariff applied to imports from non-preferential trading partners." />
                        </span>
                        <span className="font-semibold text-foreground">
                          {savingsMfnRate != null ? `${savingsMfnRate}%` : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-green-100 dark:bg-green-950/40 px-4 py-3">
                        <span className="text-sm text-foreground">AfCFTA Rate (2026)</span>
                        <span className="font-semibold text-foreground">
                          {savingsAfcfta2026 != null ? `${savingsAfcfta2026}%` : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-green-100 dark:bg-green-950/40 px-4 py-3">
                        <span className="text-sm text-foreground">AfCFTA Rate (2030)</span>
                        <span className="font-semibold text-foreground">
                          {savingsAfcfta2030 != null ? `${savingsAfcfta2030}%` : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-green-100 dark:bg-green-950/40 px-4 py-3">
                        <span className="text-sm text-foreground">AfCFTA Rate (2035)</span>
                        <span className="font-semibold text-foreground">
                          {savingsAfcfta2035 != null ? `${savingsAfcfta2035}%` : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-green-100 dark:bg-green-950/40 px-4 py-3">
                        <span className="text-sm font-semibold text-foreground">Total Savings by 2035</span>
                        <span className="font-bold text-green-800 dark:text-green-400">
                          {totalSavingsBy2035 != null ? `${totalSavingsBy2035}%` : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-8">
                      <p className="mb-2 text-sm font-medium text-foreground">
                        Calculate your savings: What is your typical shipment value?
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={shipmentValue}
                        onChange={(e) => setShipmentValue(e.target.value.replace(/[^0-9,]/g, ""))}
                        placeholder="e.g., 50000"
                        className="w-full max-w-xs rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <div className="mt-4 rounded-lg bg-green-100 dark:bg-green-950/40 px-4 py-4">
                        <p className="text-sm text-foreground">
                          Estimated Annual Savings (by {currentYear}):
                        </p>
                        <p className="mt-1 text-2xl font-bold text-green-800 dark:text-green-400">
                          ${estimatedAnnualSavingsForCurrentYear.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        {savingsRateForCurrentYear != null && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Based on {Number(savingsRateForCurrentYear.toFixed(2))}% savings vs MFN for {applicablePhaseYear} rate.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 6: Your Compliance Checklist */}
          {activeStep === "checklist" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border border-border bg-card p-6 shadow-md">
                <h2 className="text-2xl font-bold text-foreground">Your Compliance Checklist</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Here are the documents and steps you need to complete. Click each item when done.
                </p>

                <div className="mt-6 rounded-xl bg-green-100 dark:bg-green-950/40 px-6 py-5 text-center">
                  <p className="text-4xl font-bold text-green-800 dark:text-green-400">
                    {Math.round(checklistPercent)}%
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Complete</p>
                </div>

                <div className="mt-8 space-y-8">
                  {CHECKLIST_SECTIONS.map((section) => (
                    <div key={section.id}>
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground">
                        {getChecklistSectionTitle(section.titleKey)}
                      </h3>
                      <ul className="space-y-3">
                        {section.items.map((item) => {
                          const key = `${section.id}-${item.id}`;
                          const checked = checklistProgress[key];
                          return (
                            <li
                              key={key}
                              className="flex items-center gap-4 rounded-lg bg-muted/30 p-4 hover:bg-muted/50 transition-colors"
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
                              <div className="flex-1 min-w-0">
                                <span
                                  className={`block text-sm font-medium ${
                                    checked ? "text-muted-foreground line-through" : "text-foreground"
                                  }`}
                                >
                                  {item.title}
                                </span>
                                {item.subLabel && (
                                  <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {item.subLabel}
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <button
              type="button"
              onClick={goPrev}
              disabled={stepIndex === 0}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95"
              style={{ backgroundColor: ORG_ACCENT }}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <span className="text-sm text-muted-foreground">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
            {activeStep === "checklist" ? (
              <div className="flex flex-col items-end gap-2">
                {reportError && (
                  <p className="text-sm text-red-600 dark:text-red-400 text-right max-w-xs">
                    {reportError}
                    <a href="/pricing" className="ml-1 underline">Upgrade or buy a report</a>
                  </p>
                )}
                {reportUsage != null && reportUsage.canDownload && (
                  <p className="text-xs text-muted-foreground">
                    {reportUsage.remaining === null
                      ? "Unlimited reports"
                      : `${reportUsage.remaining} report${reportUsage.remaining !== 1 ? "s" : ""} remaining this month`}
                    {reportUsage.payAsYouGoCount > 0 && ` · ${reportUsage.payAsYouGoCount} pay-as-you-go`}
                  </p>
                )}
                {reportUsage != null && !reportUsage.canDownload && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Report limit reached. <a href="/pricing" className="underline">Upgrade or purchase a report</a>
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={reportDownloadStatus === "loading" || reportUsage === null || (reportUsage != null && !reportUsage.canDownload)}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-4 py-2 text-sm font-semibold text-[#1a1a1a] transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {reportDownloadStatus === "loading" ? "Preparing…" : "Download Full Report"}
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={stepIndex === STEPS.length - 1 || (activeStep === "start" && !isStartValid)}
                title={activeStep === "start" && !isStartValid ? "Fill in all required fields on the Start step to continue" : undefined}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-4 py-2 text-sm font-semibold text-[#1a1a1a] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-lg"
              >
                {activeStep === "production" ? "Continue to Origin Check" : activeStep === "origin" ? "Continue to Barrier Check" : activeStep === "ntb" ? "Continue to Tariff Savings" : activeStep === "tariff" ? "View Compliance Checklist" : "Next"}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
