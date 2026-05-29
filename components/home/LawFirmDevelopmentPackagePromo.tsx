"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingDiscountPrice } from "@/components/pricing/MarketingDiscountPrice";
import {
  LAW_FIRM_PACKAGE_LIST_PRICE_CENTS,
  LAW_FIRM_PACKAGE_SALE_PRICE_CENTS,
  isLawFirmDevelopmentMarketplaceItem,
} from "@/lib/law-firm-package-marketing";

type MarketplaceItem = {
  id: string;
  title: string;
  file_format?: string | null;
  file_name?: string | null;
};

export function LawFirmDevelopmentPackagePromo() {
  const [packageHref, setPackageHref] = useState("/marketplace");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/marketplace", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { items?: MarketplaceItem[] }) => {
        if (cancelled) return;
        const match = (data.items ?? []).find(isLawFirmDevelopmentMarketplaceItem);
        if (match?.id) setPackageHref(`/marketplace/${match.id}/package`);
      })
      .catch(() => {
        // keep /marketplace fallback
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="border-b border-border bg-gradient-to-br from-[#faf8f5] via-background to-[#f5f0eb] px-4 py-12 sm:px-8 sm:py-14 dark:from-[#1a1410] dark:via-background dark:to-[#221913]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C8922A]">
            Yamalé Vault · Featured package
          </p>
          <h2 className="heading mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            African Law Firm Development Package
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            150+ templates, guides, and courses built for African law firms — OHADA and common law throughout.
            One-time download from The Yamalé Vault.
          </p>
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <MarketingDiscountPrice
              currentCents={LAW_FIRM_PACKAGE_SALE_PRICE_CENTS}
              listPriceCents={LAW_FIRM_PACKAGE_LIST_PRICE_CENTS}
              size="default"
              showBadge={false}
            />
            <span className="pb-0.5 text-sm text-muted-foreground">one-time · Tier 1 self-service library</span>
          </div>
        </div>
        <Link
          href={packageHref}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[6px] bg-[#C8922A] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b07e22] sm:px-8"
        >
          View the package
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
