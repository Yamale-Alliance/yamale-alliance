import { slugifyCategoryName } from "@/lib/category-slug";

type CatalogTranslator = {
  (key: string): string;
  has?: (key: string) => boolean;
};

export function catalogLabelKey(englishLabel: string): string {
  return slugifyCategoryName(englishLabel).replace(/-/g, "_");
}

function translateCatalogLabel(
  englishLabel: string,
  prefix: string,
  t: CatalogTranslator
): string {
  const trimmed = englishLabel.trim();
  if (!trimmed) return englishLabel;
  const key = `${prefix}.${catalogLabelKey(trimmed)}`;
  if (t.has?.(key)) return t(key);
  return trimmed;
}

export function translateLawCategoryLabel(englishLabel: string, t: CatalogTranslator): string {
  return translateCatalogLabel(englishLabel, "lawCategories", t);
}

export function translateLawyerPracticeAreaLabel(englishLabel: string, t: CatalogTranslator): string {
  return translateCatalogLabel(englishLabel, "practiceAreas", t);
}
