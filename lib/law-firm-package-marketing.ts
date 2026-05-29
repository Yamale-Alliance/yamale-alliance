import { hasLawFirmDevelopmentBuiltInLanding } from "@/lib/marketplace-zip-package";

/** Marketing strikethrough list price for the Law Firm Development Package. */
export const LAW_FIRM_PACKAGE_LIST_PRICE_USD = 699;
export const LAW_FIRM_PACKAGE_SALE_PRICE_USD = 499;

export const LAW_FIRM_PACKAGE_LIST_PRICE_CENTS = LAW_FIRM_PACKAGE_LIST_PRICE_USD * 100;
export const LAW_FIRM_PACKAGE_SALE_PRICE_CENTS = LAW_FIRM_PACKAGE_SALE_PRICE_USD * 100;

export function isLawFirmDevelopmentMarketplaceItem(item: {
  title: string;
  file_format?: string | null;
  file_name?: string | null;
}): boolean {
  return hasLawFirmDevelopmentBuiltInLanding(item);
}

/** Show $699 → $499 strikeout when this vault ZIP is the Law Firm Development Package. */
export function shouldShowLawFirmPackageMarketingDiscount(item: {
  title: string;
  price_cents?: number;
  file_format?: string | null;
  file_name?: string | null;
}): boolean {
  if (!isLawFirmDevelopmentMarketplaceItem(item)) return false;
  return (item.price_cents ?? 0) > 0;
}
