"use client";

import { MarketingDiscountPrice } from "@/components/pricing/MarketingDiscountPrice";
import {
  LAW_FIRM_PACKAGE_LIST_PRICE_CENTS,
  LAW_FIRM_PACKAGE_SALE_PRICE_CENTS,
  shouldShowLawFirmPackageMarketingDiscount,
} from "@/lib/law-firm-package-marketing";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type LawFirmPackageDiscountPriceProps = {
  /** Sale price in cents (defaults to $499). */
  saleCents?: number;
  className?: string;
  size?: "compact" | "inline" | "hero" | "default";
  showBadge?: boolean;
  /** White card/badge vs dark package landing. */
  tone?: "light" | "dark";
};

export function LawFirmPackageDiscountPrice({
  saleCents = LAW_FIRM_PACKAGE_SALE_PRICE_CENTS,
  className,
  size = "compact",
  showBadge = false,
  tone = "light",
}: LawFirmPackageDiscountPriceProps) {
  const dark = tone === "dark";
  return (
    <MarketingDiscountPrice
      currentCents={saleCents}
      listPriceCents={LAW_FIRM_PACKAGE_LIST_PRICE_CENTS}
      size={size}
      showBadge={showBadge}
      className={cx(
        className,
        dark &&
          "[&>div>span:first-child]:text-white/45 [&>div>span:nth-child(2)]:text-[#E3BA65] [&>span:first-child]:text-white/45 [&>span:nth-child(2)]:text-[#E3BA65]"
      )}
    />
  );
}

export { shouldShowLawFirmPackageMarketingDiscount };
