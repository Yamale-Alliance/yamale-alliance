"use client";

import { useTranslations } from "next-intl";
import {
  translateLawCategoryLabel,
  translateLawyerPracticeAreaLabel,
} from "@/lib/i18n/catalog-labels";

export function useLawCategoryLabel() {
  const t = useTranslations("library");
  return (englishLabel: string) => translateLawCategoryLabel(englishLabel, t);
}

export function useLawyerPracticeAreaLabel() {
  const t = useTranslations("lawyers");
  return (englishLabel: string) => translateLawyerPracticeAreaLabel(englishLabel, t);
}
