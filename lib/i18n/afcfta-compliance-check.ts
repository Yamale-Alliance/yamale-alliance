import type { Calculator, CheckSquare, Shield, Table, TrendingDown } from "lucide-react";

export type AfcftaStepId = "start" | "production" | "origin" | "ntb" | "tariff" | "checklist";

export type AfcftaStep = {
  id: AfcftaStepId;
  label: string;
  subLabel: string;
  icon: typeof Table;
};

export type AfcftaBarrierItem = {
  id: string;
  type: "required" | "compliant" | "optional";
  title: string;
  description: string;
  howToGet?: string;
};

type StepIconMap = Record<AfcftaStepId, typeof Table>;

export function getAfcftaComplianceSteps(
  t: (key: string) => string,
  icons: StepIconMap
): AfcftaStep[] {
  return [
    { id: "start", label: t("steps.start.label"), subLabel: t("steps.start.sub"), icon: icons.start },
    { id: "production", label: t("steps.production.label"), subLabel: t("steps.production.sub"), icon: icons.production },
    { id: "origin", label: t("steps.origin.label"), subLabel: t("steps.origin.sub"), icon: icons.origin },
    { id: "ntb", label: t("steps.ntb.label"), subLabel: t("steps.ntb.sub"), icon: icons.ntb },
    { id: "tariff", label: t("steps.tariff.label"), subLabel: t("steps.tariff.sub"), icon: icons.tariff },
    { id: "checklist", label: t("steps.checklist.label"), subLabel: t("steps.checklist.sub"), icon: icons.checklist },
  ];
}

export const AFCFTA_CONTINENT_KEYS = ["Africa", "Asia", "Europe", "Americas", "Oceania"] as const;

export type AfcftaContinentKey = (typeof AFCFTA_CONTINENT_KEYS)[number];

export function getContinentLabel(continent: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    Africa: t("continents.africa"),
    Asia: t("continents.asia"),
    Europe: t("continents.europe"),
    Americas: t("continents.americas"),
    Oceania: t("continents.oceania"),
  };
  return map[continent] ?? continent;
}

export function getBarriersForDestinationI18n(
  destCountry: string,
  originCountry: string,
  t: (key: string, values?: Record<string, string | number>) => string
): AfcftaBarrierItem[] {
  const dest = destCountry.trim() || t("placeholders.yourDestination");
  const origin = originCountry.trim() || t("placeholders.yourCountry");

  return [
    {
      id: "sps",
      type: "required",
      title: t("barriers.sps.title"),
      description: t("barriers.sps.description", { dest }),
      howToGet: t("barriers.sps.howToGet", { origin }),
    },
    {
      id: "coo",
      type: "required",
      title: t("barriers.coo.title"),
      description: t("barriers.coo.description", { dest }),
      howToGet: t("barriers.coo.howToGet", { origin }),
    },
    {
      id: "import-permit",
      type: "optional",
      title: t("barriers.importPermit.title"),
      description: t("barriers.importPermit.description", { dest }),
      howToGet: t("barriers.importPermit.howToGet", { dest }),
    },
    {
      id: "customs",
      type: "required",
      title: t("barriers.customs.title"),
      description: t("barriers.customs.description", { dest }),
      howToGet: t("barriers.customs.howToGet", { dest }),
    },
    {
      id: "standards",
      type: "compliant",
      title: t("barriers.standards.title"),
      description: t("barriers.standards.description"),
    },
  ];
}

export function getChecklistSectionTitleI18n(
  key: "before_export" | "afcfta_docs" | "at_import",
  originCountry: string,
  destCountry: string,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  if (key === "before_export") {
    return t("checklist.sectionBeforeExport", {
      country: originCountry || t("placeholders.yourCountry"),
    });
  }
  if (key === "at_import") {
    return t("checklist.sectionAtImport", {
      country: destCountry || t("placeholders.destination"),
    });
  }
  return t("checklist.sectionAfcftaDocs");
}
