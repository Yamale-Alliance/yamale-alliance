"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
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
import {
  getAfcftaComplianceSteps,
  getBarriersForDestinationI18n,
  getChecklistSectionTitleI18n,
  getContinentLabel,
  AFCFTA_CONTINENT_KEYS,
  type AfcftaStepId,
} from "@/lib/i18n/afcfta-compliance-check";

/** Full journey is visible for orientation; inputs, downloads, and reset stay disabled until launch. */
const AFCFTA_COMING_SOON_READ_ONLY = true;

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

/** Tariff row from API for Savings step (by country + HS code) */
type SavingsTariffRow = {
  mfn_rate_percent: number | null;
  afcfta_2026_percent: number | null;
  afcfta_2030_percent: number | null;
  afcfta_2035_percent: number | null;
};

type ChecklistFallbackCopy = {
  registration: { title: string; sub: string };
  phytosanitary: { title: string; sub: string };
  cooApplication: { title: string; sub: string };
  productionCosts: { title: string; sub: string };
  commercialInvoice: { title: string; sub: string };
  customsDeclaration: { title: string; sub: string };
};

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
  requirementsList: CountryRequirementsPublic[] | null = null,
  fallbacks: ChecklistFallbackCopy
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
        { id: "registration", title: fallbacks.registration.title, subLabel: fallbacks.registration.sub },
        { id: "phytosanitary", title: fallbacks.phytosanitary.title, subLabel: fallbacks.phytosanitary.sub },
      ];

  const afcftaItems = [
    { id: "coo-application", title: fallbacks.cooApplication.title, subLabel: fallbacks.cooApplication.sub },
    { id: "production-costs", title: fallbacks.productionCosts.title, subLabel: fallbacks.productionCosts.sub },
  ];

  const atImportItems: { id: string; title: string; subLabel?: string }[] = importReqs
    ? [
        ...importReqs.documents.map((d, i) => ({ id: `doc-${i}`, title: d })),
        ...importReqs.regulatory.map((r, i) => ({ id: `reg-${i}`, title: r })),
      ]
    : [
        { id: "commercial-invoice", title: fallbacks.commercialInvoice.title, subLabel: fallbacks.commercialInvoice.sub },
        { id: "customs-declaration", title: fallbacks.customsDeclaration.title, subLabel: fallbacks.customsDeclaration.sub },
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
  const t = useTranslations("afcfta");
  const tJourney = useTranslations("afcfta.journey");
  const tCheck = useTranslations("afcfta.complianceCheck");
  const tCommon = useTranslations("common");
  const steps = useMemo(
    () =>
      getAfcftaComplianceSteps(tCheck, {
        start: Table,
        production: Calculator,
        origin: Calculator,
        ntb: Shield,
        tariff: TrendingDown,
        checklist: CheckSquare,
      }),
    [tCheck]
  );
  const checklistFallbacks = useMemo<ChecklistFallbackCopy>(
    () => ({
      registration: { title: tCheck("checklist.fallbackRegistration"), sub: tCheck("checklist.fallbackRegistrationSub") },
      phytosanitary: { title: tCheck("checklist.fallbackPhytosanitary"), sub: tCheck("checklist.fallbackPhytosanitarySub") },
      cooApplication: { title: tCheck("checklist.fallbackCooApplication"), sub: tCheck("checklist.fallbackCooApplicationSub") },
      productionCosts: { title: tCheck("checklist.fallbackProductionCosts"), sub: tCheck("checklist.fallbackProductionCostsSub") },
      commercialInvoice: { title: tCheck("checklist.fallbackCommercialInvoice"), sub: tCheck("checklist.fallbackCommercialInvoiceSub") },
      customsDeclaration: { title: tCheck("checklist.fallbackCustomsDeclaration"), sub: tCheck("checklist.fallbackCustomsDeclarationSub") },
    }),
    [tCheck]
  );
  const { user } = useAppUser();
  const tier = ((user?.publicMetadata?.tier ?? user?.publicMetadata?.subscriptionTier) as string) || "free";
  const isFreeTier = tier === "free";
  const inputsLocked = isFreeTier || AFCFTA_COMING_SOON_READ_ONLY;
  /** Step-to-step navigation (header + footer) allowed for preview when coming soon, or when user is on a paid tier. */
  const canBrowseSteps = AFCFTA_COMING_SOON_READ_ONLY || !isFreeTier;
  const [activeStep, setActiveStep] = useState<AfcftaStepId>("start");
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
        activeStep: AfcftaStepId;
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

      if (data.activeStep && steps.some((s) => s.id === data.activeStep)) {
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
  }, [steps]);

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

  const stepIndex = steps.findIndex((s) => s.id === activeStep);
  const progressPercent = ((stepIndex + 1) / steps.length) * 100;

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

  const checklistSections = getChecklistSectionsForRoute(
    originCountry,
    destCountry,
    hsCode,
    productName,
    requirementsFromApi,
    checklistFallbacks
  );
  const checklistFlatItems = checklistSections.flatMap((sec) =>
    sec.items.map((item) => ({ sectionId: sec.id, sectionTitleKey: sec.titleKey, itemId: item.id, title: item.title, subLabel: item.subLabel, key: `${sec.id}-${item.id}` }))
  );
  const barrierItems = getBarriersForDestinationI18n(destCountry, originCountry, tCheck);
  const barrierKeys = barrierItems.map((item) => `ntb-barrier-${item.id}`);
  const checklistTotal = checklistFlatItems.length + barrierKeys.length;
  const checklistCompleted =
    checklistFlatItems.filter(({ key }) => checklistProgress[key]).length +
    barrierKeys.filter((key) => checklistProgress[key]).length;
  const checklistPercent = checklistTotal > 0 ? (checklistCompleted / checklistTotal) * 100 : 0;

  const getChecklistSectionTitle = (key: "before_export" | "afcfta_docs" | "at_import") =>
    getChecklistSectionTitleI18n(key, originCountry, destCountry, tCheck);

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
        setReportError(
          data.error === "limit_reached"
            ? tCheck("common.reportLimitReachedPlan")
            : tCheck("common.couldNotDownloadReport")
        );
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
        barriers: barrierItems,
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
    const next = Math.min(steps.length - 1, stepIndex + 1);
    setActiveStep(steps[next].id);
  };

  const goPrev = () => {
    const prev = Math.max(0, stepIndex - 1);
    setActiveStep(steps[prev].id);
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
            {t("eyebrow")}
          </p>
          <h1 className="heading mt-6 max-w-4xl text-4xl font-bold leading-[1.12] tracking-[-0.01em] text-white sm:text-5xl lg:text-6xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/[0.65]">
            {t("heroSubtitle")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[rgba(200,146,42,0.35)] bg-[rgba(200,146,42,0.16)] px-4 py-1 text-xs font-semibold text-[#E8B84B]">
              {t("countriesBadge")}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium text-white/80">
              {t("firstOfKind")}
            </span>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-muted/35 py-5">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="rounded-2xl border border-border/70 bg-card px-6 py-5 shadow-sm">
            <p className="heading text-2xl leading-snug text-foreground">
              <span className="mr-2 align-middle text-[#C8922A]">&quot;</span>
              {t("quoteBusiness")}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card px-6 py-5 shadow-sm">
            <p className="heading text-2xl leading-snug text-foreground">
              <span className="mr-2 align-middle text-[#C8922A]">&quot;</span>
              {t("quoteMinistry")}
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
              <p className="font-semibold text-foreground dark:text-amber-50">{t("comingSoonTitle")}</p>
              <p className="mt-1 text-muted-foreground dark:text-amber-100/90">
                {t("comingSoonBody")}
              </p>
            </div>
          </div>
        )}
        <div className="mb-8 rounded-2xl border border-border/70 bg-card px-4 py-4 text-sm text-muted-foreground shadow-sm sm:px-5">
          <p>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs">
              i
            </span>
            {t("disclaimerIntro")}{" "}
            <strong className="text-foreground">
              {t("disclaimerConfirm")}
            </strong>
          </p>
        </div>

        {/* Product / trade summary bar (golden banner) when not on Start */}
        {activeStep !== "start" && (hsCode || productName || originCountry || destCountry) && (
          <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-5 py-3 shadow-md border border-border/50" style={{ background: `linear-gradient(135deg, ${ORG_PRIMARY}44, ${ORG_PRIMARY}22 50%, var(--muted) 100%)` }}>
            {productName && (
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">{t("product")}</span> <span className="font-bold text-foreground">{productName}</span>
              </span>
            )}
            {hsCode && (
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">{t("hsCode")}</span> <span className="font-bold text-foreground">{hsCode}</span>
              </span>
            )}
            {originCountry && (
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">{t("from")}</span> <span className="font-bold text-foreground">{originCountry}</span>
              </span>
            )}
            {destCountry && (
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">{t("to")}</span> <span className="font-bold text-foreground">{destCountry}</span>
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-24">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{tCheck("sidebarTitle")}</p>
            <div className="mt-4 space-y-2">
              {steps.map((step, idx) => {
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
                      <span className="block text-sm text-muted-foreground">{step.subLabel}</span>
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
                <h2 className="text-2xl font-bold text-foreground">{t("startComplianceCheck")}</h2>
                {isFreeTier && !AFCFTA_COMING_SOON_READ_ONLY && (
                  <div className="mt-3 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:text-sm">
                    <p className="font-semibold mb-1">{tCheck("start.freeTierTitle")}</p>
                    <p>
                      {tCheck("start.freeTierBody")}{" "}
                      <a href="/pricing" className="font-semibold underline">
                        {tCheck("start.viewPricing")}
                      </a>
                      .
                    </p>
                  </div>
                )}
                <div className="mt-4 rounded-lg border-l-4 border-l-amber-400 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  {tCheck("start.welcomeIntro")}{" "}
                  <span className="inline-flex items-center align-middle">
                    <InfoIcon content={tCheck("start.infoPreferentialTariffs")} />
                  </span>{" "}
                  <strong className="text-foreground">{tCheck("start.welcomePreferential")}</strong>. {tCheck("start.welcomeOutro")}
                </div>

                <div className="mt-6 space-y-5">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      {tCheck("start.hsCodeLabel")}
                      <InfoIcon content={tCheck("start.infoHsCode")} />
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
                      placeholder={tCheck("start.hsCodePlaceholder")}
                      readOnly={inputsLocked}
                      className={`w-full rounded-lg border border-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                        inputsLocked
                          ? "cursor-not-allowed bg-white text-[#0D1B2A] placeholder:text-[#6B7280]"
                          : "bg-background text-foreground placeholder:text-muted-foreground"
                      }`}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{tCheck("start.hsCodeHint")}</p>
                    {hsLookupStatus === "loading" && (
                      <p className="mt-1 text-xs text-muted-foreground">{tCheck("start.lookingUpProduct")}</p>
                    )}
                    {hsLookupStatus === "found" && (
                      <p className="mt-1 text-xs text-green-700 dark:text-green-400">
                        {tCheck("start.productLoaded")}
                      </p>
                    )}
                    {hsLookupStatus === "not-found" && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                        {tCheck("start.noTariffData")}
                      </p>
                    )}
                    {hsLookupStatus === "unauthenticated" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {tCheck("start.signInPromptPrefix")}{" "}
                        <a
                          href={`/sign-in?redirect_url=${encodeURIComponent("/afcfta/compliance-check")}`}
                          className="text-blue-600 underline"
                        >
                          {tCheck("start.signIn")}
                        </a>{" "}
                        {tCheck("start.signInPromptMiddle")}{" "}
                        <a
                          href={`/sign-up?redirect_url=${encodeURIComponent("/afcfta/compliance-check")}`}
                          className="text-blue-600 underline"
                        >
                          {tCheck("start.signUp")}
                        </a>{" "}
                        {tCheck("start.signInPromptSuffix")}
                      </p>
                    )}
                    {hsLookupStatus === "error" && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {tCheck("start.hsLookupError")}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-foreground">
                      {tCheck("start.productDescriptionLabel")} <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={productName}
                      placeholder={tCheck("start.productDescriptionPlaceholder")}
                      className="w-full rounded-lg border border-input bg-white px-4 py-3 text-sm text-[#0D1B2A] placeholder:text-[#6B7280] cursor-not-allowed focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{tCheck("start.productDescriptionHint")}</p>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      {tCheck("start.exportingFromLabel")}
                      <InfoIcon content={tCheck("start.infoExportingFrom")} />
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
                        className="rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">{tCheck("common.continent")}</option>
                        {AFCFTA_CONTINENT_KEYS.map((c) => (
                          <option key={c} value={c}>{getContinentLabel(c, tCheck)}</option>
                        ))}
                      </select>
                      <select
                        value={originCountry}
                        onChange={(e) => {
                          if (inputsLocked) return;
                          setOriginCountry(e.target.value);
                        }}
                        disabled={inputsLocked || !originContinent}
                        className="rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">{tCheck("common.country")}</option>
                        {getFilteredCountries(originContinent).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-foreground">
                      {tCheck("start.exportingToLabel")} <span className="text-destructive">*</span>
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
                        className="rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">{tCheck("common.continent")}</option>
                        {AFCFTA_CONTINENT_KEYS.map((c) => (
                          <option key={c} value={c}>{getContinentLabel(c, tCheck)}</option>
                        ))}
                      </select>
                      <select
                        value={destCountry}
                        onChange={(e) => {
                          if (inputsLocked) return;
                          setDestCountry(e.target.value);
                        }}
                        disabled={inputsLocked || !destContinent}
                        className="rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">{tCheck("common.country")}</option>
                        {getFilteredCountries(destContinent).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{tCheck("start.exportingToHint")}</p>
                  </div>

                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!AFCFTA_COMING_SOON_READ_ONLY && !isStartValid}
                    title={
                      !AFCFTA_COMING_SOON_READ_ONLY && !isStartValid
                        ? tCheck("start.startButtonTitle")
                        : undefined
                    }
                    className="w-full rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-6 py-3 text-sm font-semibold text-[#1a1a1a] shadow-md transition hover:opacity-95 hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50"
                  >
                    {tCheck("start.startButton")}
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
                <h2 className="text-2xl font-bold text-foreground">{tCheck("production.title")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tCheck("production.intro", { threshold: RVC_THRESHOLD })}
                </p>

                <div className="mt-6 rounded-xl border border-sky-200/80 bg-sky-50/90 p-4 dark:border-sky-800/40 dark:bg-sky-950/30 shadow-sm">
                  <p className="text-sm text-sky-900 dark:text-sky-100">
                    <span className="font-semibold">{tCheck("production.whatsThisForTitle")}</span>{" "}
                    {tCheck("production.whatsThisForPrefix")}{" "}
                    <span className="inline-flex items-center gap-0.5 align-middle">
                      {tCheck("production.tariffBenefitsLabel")}
                      <InfoIcon content={tCheck("production.infoTariffBenefits")} />
                    </span>
                    , {tCheck("production.whatsThisForSuffix", { threshold: RVC_THRESHOLD })}
                  </p>
                </div>

                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
                  <p className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100">
                    <Paperclip className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>{tCheck("production.uploadInvoicesTitle")}</strong> {tCheck("production.uploadInvoicesBody")}
                    </span>
                  </p>
                </div>

                <div className="mt-6 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr style={{ backgroundColor: ORG_ACCENT }}>
                        <th className="text-left p-3 font-bold text-white">{tCheck("production.tableInputMaterial")}</th>
                        <th className="text-left p-3 font-bold text-white">{tCheck("production.tableSourceCountry")}</th>
                        <th className="text-right p-3 font-bold text-white">{tCheck("production.tableCostUsd")}</th>
                        <th className="text-left p-3 font-bold text-white">{tCheck("production.tableInvoiceUpload")}</th>
                        <th className="text-center p-3 font-bold text-white">{tCheck("production.tableAfcfta")}</th>
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
                                placeholder={tCheck("production.placeholderCoffeeBeans")}
                                className={`w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow ${
                                  inputsLocked
                                    ? "cursor-not-allowed bg-white text-[#0D1B2A] placeholder:text-[#6B7280]"
                                    : "bg-background text-foreground placeholder:text-muted-foreground"
                                }`}
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
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <option value="">{tCheck("common.selectCountry")}</option>
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
                                className={`w-full rounded-lg border border-input px-3 py-2 text-sm text-right focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow ${
                                  inputsLocked
                                    ? "cursor-not-allowed bg-white text-[#0D1B2A] placeholder:text-[#6B7280]"
                                    : "bg-background text-foreground placeholder:text-muted-foreground"
                                }`}
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
                                <span className="text-sm">{tCheck("common.chooseFile")}</span>
                                {row.fileName ? (
                                  <>
                                    <span className="truncate max-w-[8rem] text-xs">{row.fileName}</span>
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{tCheck("common.noFileChosen")}</span>
                                )}
                              </label>
                            </td>
                            <td className="p-2 text-center">
                              {isAfcfta ? (
                                <CheckCircle2 className="mx-auto h-5 w-5 text-green-600 dark:text-green-400" aria-label={tCheck("common.ariaAfcftaEligible")} />
                              ) : (
                                <X className="mx-auto h-5 w-5 text-gray-400 dark:text-gray-500" aria-label={tCheck("common.ariaNotAfcfta")} strokeWidth={2.5} />
                              )}
                            </td>
                            <td className="p-2">
                              <button
                                type="button"
                                onClick={() => removeProductionRow(row.id)}
                                disabled={productionRows.length <= 1 || inputsLocked}
                                className="rounded bg-destructive/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-destructive disabled:opacity-30 disabled:pointer-events-none"
                              >
                                {tCheck("common.remove")}
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
                  {tCheck("production.addAnotherInput")}
                </button>

                {/* Cost summary */}
                <div className="mt-6 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{tCheck("production.totalProductionCost")}</span>
                    <span className="font-semibold">${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {tCheck("production.afcftaContent")}
                      <InfoIcon
                        content={tCheck("production.infoAfcftaContent")}
                      />
                    </span>
                    <span className="font-semibold">${totalAfcfta.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {tCheck("production.rvcLabel")}
                      <InfoIcon
                        content={tCheck("production.infoRvc")}
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
                <h2 className="text-2xl font-bold text-foreground">{tCheck("origin.title")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tCheck("origin.intro")}
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
                      {tCheck("origin.goodNews", {
                        rvc: totalCost > 0 ? rvcPercent.toFixed(1) : "0",
                        threshold: RVC_THRESHOLD,
                      })}
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      {tCheck("origin.notYetMet", {
                        rvc: totalCost > 0 ? rvcPercent.toFixed(1) : "0",
                        threshold: RVC_THRESHOLD,
                      })}
                    </p>
                  )}
                </div>

                {/* What this means */}
                <h3 className="mt-6 text-sm font-semibold text-foreground">{tCheck("origin.whatThisMeans")}</h3>
                <ul className="mt-3 space-y-3">
                  {rvcMeetsThreshold && destCountry && (
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
                      <span className="text-sm text-foreground">
                        {tCheck("origin.canClaimReduced", { dest: destCountry })}
                      </span>
                    </li>
                  )}
                  {rvcMeetsThreshold && (
                    <li className="flex items-start gap-3">
                      <FileText className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                      <span className="text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                        {tCheck("origin.needCertificateOfOrigin")}
                        <InfoIcon content={tCheck("origin.infoCertificateOfOrigin")} />
                      </span>
                    </li>
                  )}
                  <li className="flex items-start gap-3">
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                    <span className="text-sm text-foreground">
                      {tCheck("origin.keepRecords")}
                    </span>
                  </li>
                </ul>

                {!rvcMeetsThreshold && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    {tCheck("origin.rvcFormula", { threshold: RVC_THRESHOLD })}
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
                    {tCheck("ntb.heroTitle")}
                  </p>
                  {destCountry || originCountry ? (
                    <p className="mt-1 text-lg font-semibold">
                      {originCountry ? `${originCountry} → ` : ""}
                      {destCountry || tCheck("common.selectDestination")}
                    </p>
                  ) : (
                    <p className="mt-1 text-lg font-semibold">{tCheck("ntb.selectRoutePrompt")}</p>
                  )}
                </div>
                <div className="px-6 py-4 bg-muted/30 border-t border-border">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <InfoIcon content={tCheck("ntb.infoNtb")} />
                    <span>{tCheck("ntb.ntbIntro")}</span>
                  </p>
                </div>
              </div>

              {!destCountry ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-6 py-4 text-sm text-amber-900 dark:text-amber-100">
                  {tCheck("ntb.selectDestBanner")}
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
                      <h3 className="text-lg font-semibold">{tCheck("ntb.exportRequirements", { country: originCountry })}</h3>
                      {productCategory !== "general" && (
                        <p className="mt-0.5 text-sm text-white/90">{tCheck("common.productCategory", { category: productCategory })}</p>
                      )}
                    </div>
                    <div className="px-6 py-5 space-y-5 text-sm">
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">{tCheck("common.documents")}</h4>
                        <p className="text-xs text-muted-foreground mb-2">{tCheck("ntb.documentsExportHint", { country: originCountry })}</p>
                        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                          {exportReqs.documents.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ol>
                      </div>
                      {exportReqs.regulatory.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">{tCheck("common.regulatoryRequirements")}</h4>
                          <p className="text-xs text-muted-foreground mb-2">{tCheck("ntb.regulatoryExportHint")}</p>
                          <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                            {exportReqs.regulatory.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">{tCheck("common.complianceNotes")}</h4>
                        <p className="text-xs text-muted-foreground mb-2">{tCheck("ntb.complianceExportHint", { country: originCountry })}</p>
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
                      <h3 className="text-lg font-semibold">{tCheck("ntb.importRequirements", { country: destCountry })}</h3>
                      {productCategory !== "general" && (
                        <p className="mt-0.5 text-sm text-white/90">{tCheck("common.productCategory", { category: productCategory })}</p>
                      )}
                    </div>
                    <div className="px-6 py-5 space-y-5 text-sm">
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">{tCheck("common.documents")}</h4>
                        <p className="text-xs text-muted-foreground mb-2">{tCheck("ntb.documentsImportHint", { country: destCountry })}</p>
                        <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                          {importReqs.documents.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ol>
                      </div>
                      {importReqs.regulatory.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">{tCheck("common.regulatoryRequirements")}</h4>
                          <p className="text-xs text-muted-foreground mb-2">{tCheck("ntb.regulatoryImportHint", { country: destCountry })}</p>
                          <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                            {importReqs.regulatory.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">{tCheck("common.complianceNotes")}</h4>
                        <p className="text-xs text-muted-foreground mb-2">{tCheck("ntb.complianceImportHint", { country: destCountry })}</p>
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
                <h2 className="text-2xl font-bold text-foreground">{tCheck("tariff.title")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tCheck("tariff.intro")}
                </p>

                {savingsTariffStatus === "loading" && (
                  <p className="mt-4 text-sm text-muted-foreground">{tCheck("tariff.loadingRates")}</p>
                )}
                {savingsTariffStatus === "not-found" && (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    {tCheck("tariff.notFound")}
                  </p>
                )}
                {savingsTariffStatus === "error" && (
                  <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                    {tCheck("tariff.loadError")}
                  </p>
                )}

                {(savingsTariffStatus === "found" || savingsTariffStatus === "idle") && (
                  <>
                    <div className="mt-6 space-y-2">
                      <div className="flex items-center justify-between rounded-lg bg-green-100 dark:bg-green-950/40 px-4 py-3">
                        <span className="flex items-center gap-1.5 text-sm text-foreground">
                          {tCheck("tariff.standardMfnTariff")}
                          <InfoIcon content={tCheck("tariff.infoMfn")} />
                        </span>
                        <span className="font-semibold text-foreground">
                          {savingsMfnRate != null ? `${savingsMfnRate}%` : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-green-100 dark:bg-green-950/40 px-4 py-3">
                        <span className="text-sm text-foreground">{tCheck("tariff.afcftaRate2026")}</span>
                        <span className="font-semibold text-foreground">
                          {savingsAfcfta2026 != null ? `${savingsAfcfta2026}%` : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-green-100 dark:bg-green-950/40 px-4 py-3">
                        <span className="text-sm text-foreground">{tCheck("tariff.afcftaRate2030")}</span>
                        <span className="font-semibold text-foreground">
                          {savingsAfcfta2030 != null ? `${savingsAfcfta2030}%` : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-green-100 dark:bg-green-950/40 px-4 py-3">
                        <span className="text-sm text-foreground">{tCheck("tariff.afcftaRate2035")}</span>
                        <span className="font-semibold text-foreground">
                          {savingsAfcfta2035 != null ? `${savingsAfcfta2035}%` : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-green-100 dark:bg-green-950/40 px-4 py-3">
                        <span className="text-sm font-semibold text-foreground">{tCheck("tariff.totalSavingsBy2035")}</span>
                        <span className="font-bold text-green-800 dark:text-green-400">
                          {totalSavingsBy2035 != null ? `${totalSavingsBy2035}%` : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-8">
                      <p className="mb-2 text-sm font-medium text-foreground">
                        {tCheck("tariff.shipmentValuePrompt")}
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
                        placeholder={tCheck("tariff.shipmentPlaceholder")}
                        className={`w-full max-w-xs rounded-lg border border-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                          inputsLocked
                            ? "cursor-not-allowed bg-white text-[#0D1B2A] placeholder:text-[#6B7280]"
                            : "bg-background text-foreground placeholder:text-muted-foreground"
                        }`}
                      />
                      <div className="mt-4 rounded-lg bg-green-100 dark:bg-green-950/40 px-4 py-4">
                        <p className="text-sm text-foreground">
                          {tCheck("tariff.estimatedAnnualSavings", { year: currentYear })}
                        </p>
                        <p className="mt-1 text-2xl font-bold text-green-800 dark:text-green-400">
                          ${estimatedAnnualSavingsForCurrentYear.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        {savingsRateForCurrentYear != null && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {tCheck("tariff.savingsBasis", {
                              rate: Number(savingsRateForCurrentYear.toFixed(2)),
                              phase: applicablePhaseYear,
                            })}
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
                <h2 className="text-2xl font-bold text-foreground">{tCheck("checklist.title")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {inputsLocked ? tCheck("checklist.introPreview") : tCheck("checklist.introInteractive")}
                </p>

                <div className="mt-6 rounded-xl bg-green-100 dark:bg-green-950/40 px-6 py-5 text-center">
                  <p className="text-4xl font-bold text-green-800 dark:text-green-400">
                    {Math.round(checklistPercent)}%
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{tCheck("common.complete")}</p>
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
                        {tCheck("common.requirementsChecklist")}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {destCountry
                          ? originCountry
                            ? tCheck("common.exportingToFrom", { dest: destCountry, origin: originCountry })
                            : tCheck("common.exportingTo", { dest: destCountry })
                          : tCheck("common.generalRequirements")}
                      </p>
                    </div>
                    <ul className="divide-y divide-border">
                      {getBarriersForDestinationI18n(destCountry, originCountry, tCheck).map((item) => {
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
                                title={isSystemChecked ? tCheck("common.checkedBySystem") : undefined}
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
                                {item.type === "required"
                                  ? tCheck("common.required")
                                  : item.type === "compliant"
                                    ? tCheck("common.compliant")
                                    : tCheck("common.ifRequired")}
                              </span>
                              <div className="min-w-0 flex-1">
                                <h4 className={`font-semibold ${checked ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.title}</h4>
                                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                                {item.howToGet && (
                                  <p className="mt-3 text-sm text-muted-foreground/90 pl-3 border-l-2 border-muted-foreground/30">
                                    <span className="font-medium text-foreground">{tCheck("common.howToGetIt")}</span> {item.howToGet}
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
              {tJourney("back")}
            </button>
            <span className="text-sm text-muted-foreground">
              {tJourney("stepOf", { current: stepIndex + 1, total: steps.length })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetJourney}
                disabled={AFCFTA_COMING_SOON_READ_ONLY}
                title={AFCFTA_COMING_SOON_READ_ONLY ? tJourney("resetDisabledTitle") : undefined}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-4 w-4" />
                {tJourney("resetJourney")}
              </button>
              {activeStep === "checklist" ? (
                <div className="flex flex-col items-end gap-2">
                  {reportError && (
                    <p className="text-sm text-red-600 dark:text-red-400 text-right max-w-xs">
                      {reportError}
                      <a href="/pricing" className="ml-1 underline">{tCheck("common.upgradeOrBuyReport")}</a>
                    </p>
                  )}
                  {reportUsage != null && reportUsage.canDownload && (
                    <p className="text-xs text-muted-foreground">
                      {reportUsage.remaining === null
                        ? tCheck("common.unlimitedReports")
                        : tCheck("common.reportsRemaining", { count: reportUsage.remaining })}
                      {reportUsage.payAsYouGoCount > 0 &&
                        tCheck("common.payAsYouGoSuffix", { count: reportUsage.payAsYouGoCount })}
                    </p>
                  )}
                  {reportUsage != null && !reportUsage.canDownload && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {tCheck("common.reportLimitReached")}{" "}
                      <a href="/pricing" className="underline">{tCheck("common.upgradeOrPurchaseReport")}</a>
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
                    title={AFCFTA_COMING_SOON_READ_ONLY ? tCheck("common.reportDownloadComingSoon") : undefined}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-4 py-2 text-sm font-semibold text-[#1a1a1a] transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {reportDownloadStatus === "loading" ? tCheck("common.preparing") : tCheck("common.downloadFullReport")}
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                  <button
                    type="button"
                    onClick={canBrowseSteps ? goNext : undefined}
                    disabled={
                      !canBrowseSteps ||
                      stepIndex === steps.length - 1 ||
                      (activeStep === "start" && !isStartValid && !AFCFTA_COMING_SOON_READ_ONLY)
                    }
                    title={
                      !canBrowseSteps
                        ? tCheck("common.upgradePlanTitle")
                        : activeStep === "start" && !isStartValid && !AFCFTA_COMING_SOON_READ_ONLY
                          ? tCheck("common.fillStartFieldsTitle")
                          : undefined
                    }
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#c99d2e] px-4 py-2 text-sm font-semibold text-[#1a1a1a] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] hover:shadow-lg"
                  >
                    {activeStep === "production"
                      ? tJourney("continueToOriginCheck")
                      : activeStep === "origin"
                      ? tJourney("continueToBarrierCheck")
                      : activeStep === "ntb"
                      ? tJourney("continueToTariffSavings")
                      : activeStep === "tariff"
                      ? tJourney("viewComplianceChecklist")
                      : tJourney("nextLabel")}
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
