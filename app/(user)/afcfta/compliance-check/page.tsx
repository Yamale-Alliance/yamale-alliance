"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
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
import {
  PROTOTYPE_HERO_GRID_PATTERN,
  prototypeHeroEyebrowClass,
  prototypeNavyHeroSectionClass,
} from "@/components/layout/prototype-page-styles";
import {
  getProductCategory,
  getExportRequirements,
  getImportRequirements,
  getExportRequirementsFromList,
  getImportRequirementsFromList,
  isRequirementsCountry,
  type CountryRequirementsPublic,
} from "@/lib/afcfta-country-requirements";

/** Full journey is visible for orientation; inputs, downloads, and reset stay disabled until launch. */
const AFCFTA_COMING_SOON_READ_ONLY = true;

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
const JOURNEY_STORAGE_KEY = "yamale-afcfta-journey-v1";

type StepId = "start" | "production" | "origin" | "ntb" | "tariff" | "checklist";

const STEPS: Array<{ id: StepId; label: string; icon: typeof Table }> = [
  { id: "start", label: "Start", icon: Table },
  { id: "production", label: "Production", icon: Calculator },
  { id: "origin", label: "Origin Check", icon: Calculator },
  { id: "ntb", label: "Barriers", icon: Shield },
  { id: "tariff", label: "Savings", icon: TrendingDown },
  { id: "checklist", label: "Checklist", icon: CheckSquare },
];
const STEP_SUBLABELS: Record<StepId, string> = {
  start: "Product & route",
  production: "Cost breakdown",
  origin: "Rules of origin",
  ntb: "Non-tariff barriers",
  tariff: "Tariff savings",
  checklist: "Final checklist",
};

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

/** Build checklist sections from country-specific export/import requirements (same data as NTB). Uses requirementsList when provided (API merge with admin overrides). */
function getChecklistSectionsForRoute(
  originCountry: string,
  destCountry: string,
  hsCode: string,
  productName: string,
  requirementsList: CountryRequirementsPublic[] | null = null
): ChecklistSection[] {
  const productCategory = getProductCategory(hsCode, productName);
  const exportReqs =
    originCountry && isRequirementsCountry(originCountry)
      ? (requirementsList?.length
          ? getExportRequirementsFromList(requirementsList, originCountry, productCategory)
          : getExportRequirements(originCountry, productCategory))
      : null;
  const importReqs =
    destCountry && isRequirementsCountry(destCountry)
      ? (requirementsList?.length
          ? getImportRequirementsFromList(requirementsList, destCountry, productCategory)
          : getImportRequirements(destCountry, productCategory))
      : null;

  const beforeExportItems: { id: string; title: string; subLabel?: string }[] = exportReqs
    ? [
        ...exportReqs.documents.map((d, i) => ({ id: `doc-${i}`, title: d })),
        ...exportReqs.regulatory.map((r, i) => ({ id: `reg-${i}`, title: r })),
      ]
    : [
        { id: "registration", title: "Business Registration Certificate", subLabel: "Valid until Dec 2026" },
        { id: "phytosanitary", title: "Phytosanitary Certificate", subLabel: "From Plant Protection Service (3-5 days)" },
      ];

  const afcftaItems = [
    { id: "coo-application", title: "Certificate of Origin Application", subLabel: "Submit to authorized agency" },
    { id: "production-costs", title: "Production Cost Records", subLabel: "Keep invoices and receipts for 5 years" },
  ];

  const atImportItems: { id: string; title: string; subLabel?: string }[] = importReqs
    ? [
        ...importReqs.documents.map((d, i) => ({ id: `doc-${i}`, title: d })),
        ...importReqs.regulatory.map((r, i) => ({ id: `reg-${i}`, title: r })),
      ]
    : [
        { id: "commercial-invoice", title: "Commercial Invoice", subLabel: "With HS code and AfCFTA claim" },
        { id: "customs-declaration", title: "Customs Declaration", subLabel: "Filed at port of entry" },
      ];

  return [
    { id: "before-export", titleKey: "before_export", items: beforeExportItems },
    { id: "afcfta-docs", titleKey: "afcfta_docs", items: afcftaItems },
    { id: "at-import", titleKey: "at_import", items: atImportItems },
  ];
}

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
  const { user } = useUser();
  const tier = ((user?.publicMetadata?.tier ?? user?.publicMetadata?.subscriptionTier) as string) || "free";
  const isFreeTier = tier === "free";
  const inputsLocked = isFreeTier || AFCFTA_COMING_SOON_READ_ONLY;
  /** Step-to-step navigation (header + footer) allowed for preview when coming soon, or when user is on a paid tier. */
  const canBrowseSteps = AFCFTA_COMING_SOON_READ_ONLY || !isFreeTier;
  const [activeStep, setActiveStep] = useState<StepId>("start");
  const [hsCode, setHsCode] = useState("");
  const [productName, setProductName] = useState("");
  const [originContinent, setOriginContinent] = useState("Africa");
  const [originCountry, setOriginCountry] = useState("");
  const [destContinent, setDestContinent] = useState("Africa");
  const [destCountry, setDestCountry] = useState("");
  const [productionRows, setProductionRows] = useState<ProductionRow[]>([
    { id: "1", description: "", sourceCountry: "", cost: "", fileName: "" },
  ]);
  const [checklistProgress, setChecklistProgress] = useState<Record<string, boolean>>({});
  const [hsLookupStatus, setHsLookupStatus] = useState<
    "idle" | "loading" | "found" | "not-found" | "error" | "unauthenticated"
  >("idle");
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
  const [requirementsFromApi, setRequirementsFromApi] = useState<CountryRequirementsPublic[] | null>(null);

  // Fetch merged requirements (lib + admin overrides) for compliance tool
  useEffect(() => {
    if (AFCFTA_COMING_SOON_READ_ONLY) return;
    fetch("/api/afcfta/requirements", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setRequirementsFromApi(Array.isArray(data) ? data : null))
      .catch(() => setRequirementsFromApi(null));
  }, []);

  // Demo data for read-only preview (no localStorage restore in this mode)
  useEffect(() => {
    if (!AFCFTA_COMING_SOON_READ_ONLY) return;
    setHsCode("090111");
    setProductName("Coffee, not roasted, not decaffeinated");
    setOriginContinent("Africa");
    setOriginCountry("Ghana");
    setDestContinent("Africa");
    setDestCountry("Nigeria");
    setProductionRows([
      { id: "1", description: "Green coffee beans", sourceCountry: "Ghana", cost: "12000", fileName: "" },
      { id: "2", description: "Packaging materials", sourceCountry: "China", cost: "3000", fileName: "" },
    ]);
    setShipmentValue("50000");
    setHsLookupStatus("idle");
  }, []);

  // Hydrate journey state from localStorage so refreshing the page keeps the current step and inputs
  useEffect(() => {
    if (typeof window === "undefined" || AFCFTA_COMING_SOON_READ_ONLY) return;
    try {
      const raw = window.localStorage.getItem(JOURNEY_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<{
        activeStep: StepId;
        hsCode: string;
        productName: string;
        originContinent: string;
        originCountry: string;
        destContinent: string;
        destCountry: string;
        productionRows: ProductionRow[];
        checklistProgress: Record<string, boolean>;
        shipmentValue: string;
      }> | null;
      if (!data) return;

      if (data.activeStep && STEPS.some((s) => s.id === data.activeStep)) {
        setActiveStep(data.activeStep);
      }
      if (typeof data.hsCode === "string") setHsCode(data.hsCode);
      if (typeof data.productName === "string") setProductName(data.productName);
      if (typeof data.originContinent === "string") setOriginContinent(data.originContinent);
      if (typeof data.originCountry === "string") setOriginCountry(data.originCountry);
      if (typeof data.destContinent === "string") setDestContinent(data.destContinent);
      if (typeof data.destCountry === "string") setDestCountry(data.destCountry);
      if (Array.isArray(data.productionRows) && data.productionRows.length > 0) {
        setProductionRows(data.productionRows);
      }
      if (data.checklistProgress && typeof data.checklistProgress === "object") {
        setChecklistProgress(data.checklistProgress);
      }
      if (typeof data.shipmentValue === "string") setShipmentValue(data.shipmentValue);
    } catch {
      // ignore hydration errors
    }
  }, []);

  // Persist journey state whenever key inputs change
  useEffect(() => {
    if (typeof window === "undefined" || AFCFTA_COMING_SOON_READ_ONLY) return;
    const snapshot = {
      activeStep,
      hsCode,
      productName,
      originContinent,
      originCountry,
      destContinent,
      destCountry,
      productionRows,
      checklistProgress,
      shipmentValue,
    };
    try {
      window.localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // ignore persistence errors
    }
  }, [
    activeStep,
    hsCode,
    productName,
    originContinent,
    originCountry,
    destContinent,
    destCountry,
    productionRows,
    checklistProgress,
    shipmentValue,
  ]);

  useEffect(() => {
    if (AFCFTA_COMING_SOON_READ_ONLY) {
      if (activeStep === "tariff") {
        setSavingsTariffRow({
          mfn_rate_percent: 15,
          afcfta_2026_percent: 10,
          afcfta_2030_percent: 5,
          afcfta_2035_percent: 0,
        });
        setSavingsTariffStatus("found");
      } else {
        setSavingsTariffRow(null);
        setSavingsTariffStatus("idle");
      }
      return;
    }
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
    if (AFCFTA_COMING_SOON_READ_ONLY) {
      setReportUsage({
        canDownload: false,
        limit: 0,
        used: 0,
        remaining: 0,
        payAsYouGoCount: 0,
      });
      return;
    }
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

  // Scroll to top when changing steps so the new step content is visible
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  // When product qualifies for AfCFTA (RVC meets threshold), auto-check "Product standards – compliant" on the checklist (system-determined)
  useEffect(() => {
    if (rvcMeetsThreshold) {
      setChecklistProgress((prev) => ({ ...prev, "ntb-barrier-standards": true }));
    }
  }, [rvcMeetsThreshold]);

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

  const checklistSections = getChecklistSectionsForRoute(originCountry, destCountry, hsCode, productName, requirementsFromApi);
  const checklistFlatItems = checklistSections.flatMap((sec) =>
    sec.items.map((item) => ({ sectionId: sec.id, sectionTitleKey: sec.titleKey, itemId: item.id, title: item.title, subLabel: item.subLabel, key: `${sec.id}-${item.id}` }))
  );
  const barrierItems = getBarriersForDestination(destCountry, originCountry);
  const barrierKeys = barrierItems.map((item) => `ntb-barrier-${item.id}`);
  const checklistTotal = checklistFlatItems.length + barrierKeys.length;
  const checklistCompleted =
    checklistFlatItems.filter(({ key }) => checklistProgress[key]).length +
    barrierKeys.filter((key) => checklistProgress[key]).length;
  const checklistPercent = checklistTotal > 0 ? (checklistCompleted / checklistTotal) * 100 : 0;

  const getChecklistSectionTitle = (key: "before_export" | "afcfta_docs" | "at_import") => {
    if (key === "before_export") return `Before Export (in ${originCountry || "your country"})`;
    if (key === "at_import") return `At Import (in ${destCountry || "destination"})`;
    return "AfCFTA Documentation";
  };

  const toggleChecklist = (key: string) => {
    setChecklistProgress((prev) => ({ ...prev, [key]: !prev[key] }));
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
        checklistSections,
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

  const resetJourney = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(JOURNEY_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    setActiveStep("start");
    setHsCode("");
    setProductName("");
    setOriginContinent("Africa");
    setOriginCountry("");
    setDestContinent("Africa");
    setDestCountry("");
    setProductionRows([{ id: "1", description: "", sourceCountry: "", cost: "", fileName: "" }]);
    setChecklistProgress({});
    setHsLookupStatus("idle");
    setReportUsage(null);
    setReportDownloadStatus("idle");
    setReportError(null);
    setShipmentValue("");
    setSavingsTariffRow(null);
    setSavingsTariffStatus("idle");
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
      if (res.status === 401) {
        setHsLookupStatus("unauthenticated");
        return;
      }
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
      // Network / auth issues (e.g. blocked when not signed in) surface as TypeError: Failed to fetch
      if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
        setHsLookupStatus("unauthenticated");
      } else {
        console.error("HS lookup failed", err);
        setHsLookupStatus("error");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <section className={prototypeNavyHeroSectionClass}>
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundImage: PROTOTYPE_HERO_GRID_PATTERN }}
          aria-hidden
        />
        <div className="relative z-[1] mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:px-8">
          <p className={prototypeHeroEyebrowClass}>
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8B84B] shadow-[0_0_0_4px_rgba(200,146,42,0.2)]" />
            AfCFTA Compliance
          </p>
          <h1 className="heading mt-6 max-w-4xl text-4xl font-bold leading-[1.12] tracking-[-0.01em] text-white sm:text-5xl lg:text-6xl">
            The AfCFTA compliance infrastructure your business - or your ministry - needs.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/[0.65]">
            The first tool that walks you through every step and document required to legally ship goods across African
            borders under the Continental Free Trade Area.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[rgba(200,146,42,0.35)] bg-[rgba(200,146,42,0.16)] px-4 py-1 text-xs font-semibold text-[#E8B84B]">
              54 countries
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium text-white/80">
              First-of-its-kind tool
            </span>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-muted/35 py-5">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="rounded-2xl border border-border/70 bg-card px-6 py-5 shadow-sm">
            <p className="heading text-2xl leading-snug text-foreground">
              <span className="mr-2 align-middle text-[#C8922A]">&quot;</span>
              Understand the rules of every African market - at a price that makes sense.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card px-6 py-5 shadow-sm">
            <p className="heading text-2xl leading-snug text-foreground">
              <span className="mr-2 align-middle text-[#C8922A]">&quot;</span>
              The AfCFTA compliance infrastructure your ministry - or your business - needs.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {AFCFTA_COMING_SOON_READ_ONLY && (
          <div
            className="mb-6 flex gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100 sm:px-5 sm:py-4"
            role="status"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <div>
              <p className="font-semibold text-foreground dark:text-amber-50">Coming soon</p>
              <p className="mt-1 text-muted-foreground dark:text-amber-100/90">
                Browse every step of the AfCFTA compliance journey below. Fields, checklists, downloads, and reset are
                read-only until we launch the live tool.
              </p>
            </div>
          </div>
        )}
        <div className="mb-8 rounded-2xl border border-border/70 bg-card px-4 py-4 text-sm text-muted-foreground shadow-sm sm:px-5">
          <p>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs">
              i
            </span>
            The AfCFTA Passport provides general guidance on cross-border trade compliance under the African Continental
            Free Trade Area. Requirements shown are based on available official sources and are updated regularly.
            However, implementation of AfCFTA rules varies by country and border crossing.{" "}
            <strong className="text-foreground">
              Always confirm current requirements with the relevant customs authority before shipping.
            </strong>
          </p>
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-24">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Compliance journey</p>
            <div className="mt-4 space-y-2">
              {STEPS.map((step, idx) => {
                const isActive = activeStep === step.id;
                const isCompleted = idx < stepIndex;
                const canJump = AFCFTA_COMING_SOON_READ_ONLY || idx <= stepIndex + 1;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (!canJump) return;
                      setActiveStep(step.id);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      isActive
                        ? "border-[#C8922A]/40 bg-[#C8922A]/10"
                        : "border-transparent hover:border-border hover:bg-muted/40"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        isActive
                          ? "bg-[#0D1B2A] text-white"
                          : isCompleted
                            ? "bg-[#C8922A] text-white"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-semibold text-foreground">{step.label}</span>
                      <span className="block text-sm text-muted-foreground">{STEP_SUBLABELS[step.id]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-6">
          {/* Step 1: Start Your Compliance Check */}
          {activeStep === "start" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border border-border bg-card p-6 shadow-md">
                <h2 className="text-2xl font-bold text-foreground">Start Your Compliance Check</h2>
                {isFreeTier && !AFCFTA_COMING_SOON_READ_ONLY && (
                  <div className="mt-3 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:text-sm">
                    <p className="font-semibold mb-1">Read-only for Free plan</p>
                    <p>
                      You can explore the AfCFTA compliance steps here, but interactive inputs and downloadable
                      reports are only available on paid plans.{" "}
                      <a href="/pricing" className="font-semibold underline">
                        View pricing
                      </a>
                      .
                    </p>
                  </div>
                )}
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
                        if (inputsLocked) return;
                        setHsCode(e.target.value);
                        setHsLookupStatus("idle");
                        setProductName("");
                      }}
                      onBlur={() => {
                        if (inputsLocked) return;
                        lookupProductByHsCode(hsCode);
                      }}
                      placeholder="e.g. 012222"
                      readOnly={inputsLocked}
                      className={`w-full rounded-lg border border-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                        inputsLocked ? "bg-muted/50 cursor-not-allowed" : "bg-background"
                      }`}
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
                    {hsLookupStatus === "unauthenticated" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Please{" "}
                        <a
                          href={`/sign-in?redirect_url=${encodeURIComponent("/afcfta/compliance-check")}`}
                          className="text-blue-600 underline"
                        >
                          sign in
                        </a>{" "}
                        or{" "}
                        <a
                          href={`/sign-up?redirect_url=${encodeURIComponent("/afcfta/compliance-check")}`}
                          className="text-blue-600 underline"
                        >
                          sign up
                        </a>{" "}
                        to look up HS codes for your products.
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
                          if (inputsLocked) return;
                          setOriginContinent(e.target.value);
                          setOriginCountry("");
                        }}
                        disabled={inputsLocked}
                        className="rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">Continent</option>
                        {CONTINENTS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        value={originCountry}
                        onChange={(e) => {
                          if (inputsLocked) return;
                          setOriginCountry(e.target.value);
                        }}
                        disabled={inputsLocked || !originContinent}
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
                          if (inputsLocked) return;
                          setDestContinent(e.target.value);
                          setDestCountry("");
                        }}
                        disabled={inputsLocked}
                        className="rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">Continent</option>
                        {CONTINENTS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        value={destCountry}
                        onChange={(e) => {
                          if (inputsLocked) return;
                          setDestCountry(e.target.value);
                        }}
                        disabled={inputsLocked || !destContinent}
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
                    disabled={!AFCFTA_COMING_SOON_READ_ONLY && !isStartValid}
                    title={
                      !AFCFTA_COMING_SOON_READ_ONLY && !isStartValid
                        ? "Fill in HS Code, Product Description, Exporting From, and Exporting To to continue"
                        : undefined
                    }
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
                                readOnly={inputsLocked}
                                onChange={(e) => {
                                  if (inputsLocked) return;
                                  updateProductionRow(row.id, "description", e.target.value);
                                }}
                                placeholder="e.g. Coffee Beans"
                                className={`w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow ${inputsLocked ? "cursor-not-allowed bg-muted/50" : "bg-background"}`}
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={row.sourceCountry}
                                disabled={inputsLocked}
                                onChange={(e) => {
                                  if (inputsLocked) return;
                                  updateProductionRow(row.id, "sourceCountry", e.target.value);
                                }}
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <option value="">Select country</option>
                                {AFCFTA_COUNTRIES.map((c) => (
                                  <option key={c} value={c}>{c}</option>
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
                                readOnly={inputsLocked}
                                onChange={(e) => {
                                  if (inputsLocked) return;
                                  updateProductionRow(row.id, "cost", e.target.value);
                                }}
                                placeholder="0"
                                className={`w-full rounded-lg border border-input px-3 py-2 text-sm text-right focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow ${inputsLocked ? "cursor-not-allowed bg-muted/50" : "bg-background"}`}
                              />
                            </td>
                            <td className="p-2">
                              <label
                                className={`flex items-center gap-2 text-muted-foreground ${inputsLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:text-foreground"}`}
                              >
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  disabled={inputsLocked}
                                  onChange={(e) => {
                                    if (inputsLocked) return;
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
                                disabled={productionRows.length <= 1 || inputsLocked}
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
                  disabled={inputsLocked}
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
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

          {/* Step 4: Non-Tariff Barrier Check — destination-specific, modern layout */}
          {activeStep === "ntb" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              {/* Hero: route + title */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                <div
                  className="px-6 py-4 text-white"
                  style={{ background: `linear-gradient(135deg, ${ORG_ACCENT} 0%, ${ORG_PRIMARY} 100%)` }}
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-white/90">
                    Non-Tariff Barrier Check
                  </p>
                  {destCountry || originCountry ? (
                    <p className="mt-1 text-lg font-semibold">
                      {originCountry ? `${originCountry} → ` : ""}
                      {destCountry || "Select destination"}
                    </p>
                  ) : (
                    <p className="mt-1 text-lg font-semibold">Select your route in Start to see requirements</p>
                  )}
                </div>
                <div className="px-6 py-4 bg-muted/30 border-t border-border">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <InfoIcon content="Non-tariff barriers are rules, procedures, or standards (e.g. licences, SPS certificates, quality standards) that affect trade without being a customs tariff. They must be met for your goods to enter the destination market." />
                    <span>
                      <strong className="text-foreground">Non-tariff barriers</strong> are licences, certificates, and standards you must meet for your goods to enter the destination market.
                    </span>
                  </p>
                </div>
              </div>

              {!destCountry ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-6 py-4 text-sm text-amber-900 dark:text-amber-100">
                  Select a <strong>destination country</strong> in the Start step to see import requirements for your export market. Your actionable checklist is on the last step.
                </div>
              ) : null}

              {/* Export Requirements (origin country) — when origin is in supported list; numbered required docs, no checkboxes */}
              {originCountry && isRequirementsCountry(originCountry) && (() => {
                const productCategory = getProductCategory(hsCode, productName);
                const exportReqs =
                  requirementsFromApi?.length
                    ? getExportRequirementsFromList(requirementsFromApi, originCountry, productCategory)
                    : getExportRequirements(originCountry, productCategory);
                if (!exportReqs) return null;
                return (
                  <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border text-white" style={{ backgroundColor: ORG_PRIMARY }}>
                      <h3 className="text-lg font-semibold">Export Requirements ({originCountry})</h3>
                      {productCategory !== "general" && (
                        <p className="mt-0.5 text-sm text-white/90">Product category: {productCategory}</p>
                      )}
                    </div>
                    <div className="px-6 py-5 space-y-5 text-sm">
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">Documents</h4>
                        <p className="text-xs text-muted-foreground mb-2">Papers you must have to clear goods for export from {originCountry}.</p>
                        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                          {exportReqs.documents.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ol>
                      </div>
                      {exportReqs.regulatory.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">Regulatory requirements</h4>
                          <p className="text-xs text-muted-foreground mb-2">Permits, licences or certificates that may be required by law.</p>
                          <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                            {exportReqs.regulatory.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">Compliance notes</h4>
                        <p className="text-xs text-muted-foreground mb-2">Things to keep in mind when exporting from {originCountry}.</p>
                        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                          {exportReqs.complianceNotes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Import Requirements (destination country) — when destination is in supported list; numbered required docs, no checkboxes */}
              {destCountry && isRequirementsCountry(destCountry) && (() => {
                const productCategory = getProductCategory(hsCode, productName);
                const importReqs =
                  requirementsFromApi?.length
                    ? getImportRequirementsFromList(requirementsFromApi, destCountry, productCategory)
                    : getImportRequirements(destCountry, productCategory);
                if (!importReqs) return null;
                return (
                  <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border text-white" style={{ backgroundColor: ORG_ACCENT }}>
                      <h3 className="text-lg font-semibold">Import Requirements ({destCountry})</h3>
                      {productCategory !== "general" && (
                        <p className="mt-0.5 text-sm text-white/90">Product category: {productCategory}</p>
                      )}
                    </div>
                    <div className="px-6 py-5 space-y-5 text-sm">
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">Documents</h4>
                        <p className="text-xs text-muted-foreground mb-2">Papers required by {destCountry} customs to clear your shipment at arrival.</p>
                        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                          {importReqs.documents.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ol>
                      </div>
                      {importReqs.regulatory.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">Regulatory requirements</h4>
                          <p className="text-xs text-muted-foreground mb-2">Permits, health certificates or approvals that may be required by {destCountry}.</p>
                          <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                            {importReqs.regulatory.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">Compliance notes</h4>
                        <p className="text-xs text-muted-foreground mb-2">Things to keep in mind when importing into {destCountry}.</p>
                        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                          {importReqs.complianceNotes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                        readOnly={inputsLocked}
                        onChange={(e) => {
                          if (inputsLocked) return;
                          setShipmentValue(e.target.value.replace(/[^0-9,]/g, ""));
                        }}
                        placeholder="e.g., 50000"
                        className={`w-full max-w-xs rounded-lg border border-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${inputsLocked ? "cursor-not-allowed bg-muted/50" : "bg-background"}`}
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

          {/* Step 6: Your Compliance Checklist — sections and items from same country-specific export/import data as NTB */}
          {activeStep === "checklist" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="rounded-xl border border-border bg-card p-6 shadow-md">
                <h2 className="text-2xl font-bold text-foreground">Your Compliance Checklist</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Here are the documents and steps you need to complete.
                  {inputsLocked ? " Preview only — checklist interaction is disabled." : " Click each item when done."}
                </p>

                <div className="mt-6 rounded-xl bg-green-100 dark:bg-green-950/40 px-6 py-5 text-center">
                  <p className="text-4xl font-bold text-green-800 dark:text-green-400">
                    {Math.round(checklistPercent)}%
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Complete</p>
                </div>

                <div className="mt-8 space-y-8">
                  {checklistSections.map((section) => (
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
                                onClick={() => !inputsLocked && toggleChecklist(key)}
                                disabled={inputsLocked}
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

                  {/* Requirements checklist — Exporting to X from Y (same barrier items as NTB, but only on last page) */}
                  <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-muted/20">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                        Requirements checklist
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {destCountry
                          ? `Exporting to ${destCountry}${originCountry ? ` from ${originCountry}` : ""}`
                          : "General requirements"}
                      </p>
                    </div>
                    <ul className="divide-y divide-border">
                      {getBarriersForDestination(destCountry, originCountry).map((item) => {
                        const key = `ntb-barrier-${item.id}`;
                        const isSystemChecked = item.id === "standards" && rvcMeetsThreshold;
                        const checked = isSystemChecked || !!checklistProgress[key];
                        return (
                          <li key={item.id} className="px-6 py-5 hover:bg-muted/10 transition-colors">
                            <div className="flex items-start gap-4">
                              <button
                                type="button"
                                onClick={isSystemChecked || inputsLocked ? undefined : () => toggleChecklist(key)}
                                disabled={isSystemChecked || inputsLocked}
                                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-all ${
                                  checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-input bg-background"
                                } ${isSystemChecked ? "cursor-default opacity-100" : ""}`}
                                aria-pressed={checked}
                                title={isSystemChecked ? "Checked by system – your product meets AfCFTA RVC" : undefined}
                              >
                                {checked && <CheckCircle2 className="h-4 w-4" />}
                              </button>
                              <span
                                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  item.type === "required"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                                    : item.type === "compliant"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                                      : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                                }`}
                              >
                                {item.type === "required" ? "Required" : item.type === "compliant" ? "Compliant" : "If required"}
                              </span>
                              <div className="min-w-0 flex-1">
                                <h4 className={`font-semibold ${checked ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.title}</h4>
                                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                                {item.howToGet && (
                                  <p className="mt-3 text-sm text-muted-foreground/90 pl-3 border-l-2 border-muted-foreground/30">
                                    <span className="font-medium text-foreground">How to get it:</span> {item.howToGet}
                                  </p>
                                )}
                              </div>
                              {item.type === "required" && !checked && <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />}
                              {item.type === "compliant" && !checked && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />}
                              {item.type === "optional" && !checked && <FileText className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <button
              type="button"
              onClick={canBrowseSteps ? goPrev : undefined}
              disabled={stepIndex === 0 || !canBrowseSteps}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95"
              style={{ backgroundColor: ORG_ACCENT }}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <span className="text-sm text-muted-foreground">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetJourney}
                disabled={AFCFTA_COMING_SOON_READ_ONLY}
                title={AFCFTA_COMING_SOON_READ_ONLY ? "Reset is disabled in preview mode" : undefined}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-4 w-4" />
                Reset journey
              </button>
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
                    disabled={
                      AFCFTA_COMING_SOON_READ_ONLY ||
                      reportDownloadStatus === "loading" ||
                      reportUsage === null ||
                      (reportUsage != null && !reportUsage.canDownload)
                    }
                    title={AFCFTA_COMING_SOON_READ_ONLY ? "Report download is coming soon" : undefined}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-4 py-2 text-sm font-semibold text-[#1a1a1a] transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {reportDownloadStatus === "loading" ? "Preparing…" : "Download Full Report"}
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                  <button
                    type="button"
                    onClick={canBrowseSteps ? goNext : undefined}
                    disabled={
                      !canBrowseSteps ||
                      stepIndex === STEPS.length - 1 ||
                      (activeStep === "start" && !isStartValid && !AFCFTA_COMING_SOON_READ_ONLY)
                    }
                    title={
                      !canBrowseSteps
                        ? "Upgrade your plan to run an interactive AfCFTA compliance check"
                        : activeStep === "start" && !isStartValid && !AFCFTA_COMING_SOON_READ_ONLY
                          ? "Fill in all required fields on the Start step to continue"
                          : undefined
                    }
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-4 py-2 text-sm font-semibold text-[#1a1a1a] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-lg"
                  >
                    {activeStep === "production"
                      ? "Continue to Origin Check"
                      : activeStep === "origin"
                      ? "Continue to Barrier Check"
                      : activeStep === "ntb"
                      ? "Continue to Tariff Savings"
                      : activeStep === "tariff"
                      ? "View Compliance Checklist"
                      : "Next"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
