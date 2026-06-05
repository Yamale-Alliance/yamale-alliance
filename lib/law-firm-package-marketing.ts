import { hasLawFirmDevelopmentBuiltInLanding } from "@/lib/marketplace-zip-package";
import { ADVISORY_BASE } from "@/lib/law-firm-development/routes";

/** Online implementation workspace (Tier 1 course platform). */
export const LAW_FIRM_ADVISORY_WORKSPACE_HREF = ADVISORY_BASE;

export const LAW_FIRM_WORKSPACE_CTA_LABEL = "Open implementation workspace";

export const LAW_FIRM_WORKSPACE_CTA_SHORT = "Implementation workspace";

export const LAW_FIRM_VIEW_COURSE_LABEL = "View course";

/** Marketing strikethrough list price for the Law Firm Development Package. */
export const LAW_FIRM_PACKAGE_LIST_PRICE_USD = 699;
export const LAW_FIRM_PACKAGE_SALE_PRICE_USD = 499;

export const LAW_FIRM_PACKAGE_LIST_PRICE_CENTS = LAW_FIRM_PACKAGE_LIST_PRICE_USD * 100;
export const LAW_FIRM_PACKAGE_SALE_PRICE_CENTS = LAW_FIRM_PACKAGE_SALE_PRICE_USD * 100;

/** Strict title match for Tier 1 Law Firm Development (not generic “for African Law Firms” templates). */
export function titleLooksLikeLawFirmDevelopmentPackage(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.includes("law firm development") ||
    (t.includes("law firm") && t.includes("development") && t.includes("package")) ||
    (t.includes("african law firm") && t.includes("development"))
  );
}

export function isLawFirmDevelopmentMarketplaceItem(item: {
  title: string;
  file_format?: string | null;
  file_name?: string | null;
  is_course?: boolean | null;
}): boolean {
  if (item.is_course === true) return usesBuiltInLawFirmDevelopmentCatalog(item);
  return hasLawFirmDevelopmentBuiltInLanding(item) || titleLooksLikeLawFirmDevelopmentPackage(item.title);
}

function usesBuiltInLawFirmDevelopmentCatalog(item: {
  title: string;
  file_format?: string | null;
  file_name?: string | null;
}): boolean {
  return (
    hasLawFirmDevelopmentBuiltInLanding(item) || titleLooksLikeLawFirmDevelopmentPackage(item.title)
  );
}

/** Show $699 → $499 strikeout when this vault ZIP is the Law Firm Development Package. */
export function shouldShowLawFirmPackageMarketingDiscount(item: {
  title: string;
  price_cents?: number;
  file_format?: string | null;
  file_name?: string | null;
  is_course?: boolean | null;
}): boolean {
  if (!item.is_course) return false;
  if (!usesBuiltInLawFirmDevelopmentCatalog(item)) return false;
  return (item.price_cents ?? 0) > 0;
}
