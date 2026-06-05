import { hasLawFirmDevelopmentBuiltInLanding } from "@/lib/marketplace-zip-package";
import { titleLooksLikeLawFirmDevelopmentPackage } from "@/lib/law-firm-package-marketing";

export type MarketplaceCourseItem = {
  id: string;
  slug?: string | null;
  title: string;
  is_course?: boolean;
  file_format?: string | null;
  file_name?: string | null;
};

/** Vault item is an online course workspace (admin-controlled). */
export function isMarketplaceCourseItem(item: {
  is_course?: boolean | null;
  title?: string;
}): boolean {
  if (item.is_course === true) return true;
  return false;
}

/** Built-in Tier 1 programme catalog applies when no modules exist in DB yet. */
export function usesBuiltInLawFirmDevelopmentCatalog(item: {
  title: string;
  file_format?: string | null;
  file_name?: string | null;
}): boolean {
  return (
    hasLawFirmDevelopmentBuiltInLanding(item) || titleLooksLikeLawFirmDevelopmentPackage(item.title)
  );
}

export function marketplaceCourseParam(item: { id: string; slug?: string | null }): string {
  return item.slug?.trim() || item.id;
}

export function advisoryCourseHref(item: { id: string; slug?: string | null }): string {
  return `/advisory?course=${encodeURIComponent(marketplaceCourseParam(item))}`;
}

export function moduleKeyFromZipPath(zipPath: string): string {
  const normalized = zipPath.replace(/^\/+/, "").replace(/\\/g, "/");
  const base = normalized
    .replace(/\.[^./]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "module";
}

export function titleFromZipPath(zipPath: string): string {
  const name = zipPath.split(/[/\\]/).pop() ?? zipPath;
  const withoutExt = name.replace(/\.[^.]+$/, "");
  return withoutExt.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || name;
}

export function categoryKeyFromZipPath(zipPath: string): string | null {
  const parts = zipPath.replace(/^\/+/, "").split(/[/\\]/).filter(Boolean);
  if (parts.length < 2) return null;
  const folder = parts[parts.length - 2];
  return folder
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function categoryNameFromKey(key: string): string {
  return key
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
