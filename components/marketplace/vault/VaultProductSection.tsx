"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { VaultProductGrid } from "./VaultProductGrid";
import type { MarketplaceProductCardProduct } from "@/components/marketplace/MarketplaceProductCard";
import type { MarketplaceBrowseItem } from "@/lib/marketplace-browse-data";
import type { VaultDisplayProductCard } from "@/lib/marketplace-vault-display-cards";
import type { VaultSubcategoryId } from "@/lib/marketplace-vault-categories";

type VaultProductSectionProps = {
  title: string;
  viewAllHref?: string;
  displayCards: VaultDisplayProductCard[];
  seriesMembersByKey: Map<string, MarketplaceBrowseItem[]>;
  expandedSeriesKey: string | null;
  onToggleSeries: (seriesKey: string) => void;
  layout?: "grid" | "rail";
  muted?: boolean;
  variant?: "default" | "series";
  isSignedIn: boolean;
  cartItemIds: Set<string>;
  addingToCart: string | null;
  advisoryWorkspacePreview: boolean;
  onAddToCart: (productId: string, e: React.MouseEvent) => void;
  onRemoveFromCart: (productId: string, e: React.MouseEvent) => void;
  onBuy: (product: MarketplaceProductCardProduct, e: React.MouseEvent) => void;
  onBuySeries: (seriesId: VaultSubcategoryId, e: React.MouseEvent) => void;
};

export function VaultProductSection({
  title,
  viewAllHref,
  displayCards,
  seriesMembersByKey,
  expandedSeriesKey,
  onToggleSeries,
  layout = "rail",
  muted = false,
  variant = "default",
  ...gridProps
}: VaultProductSectionProps) {
  const t = useTranslations("marketplace");
  const pathname = usePathname();

  if (displayCards.length === 0) return null;

  const viewAllPath = viewAllHref?.split("?")[0]?.split("#")[0];
  const viewAllScroll = Boolean(viewAllPath && viewAllPath !== pathname);

  const sectionClass =
    variant === "series"
      ? "bg-gradient-to-b from-[#0c1628] to-[#111d32] text-white"
      : muted
        ? "bg-muted/30"
        : "bg-background";

  const titleClass =
    variant === "series"
      ? "text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]"
      : "text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]";

  const borderClass =
    variant === "series" ? "border-b border-white/10 pb-4" : "border-b border-border/50 pb-4";

  const viewAllClass =
    variant === "series"
      ? "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-white/15"
      : "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#C8922A]/30 bg-[#C8922A]/10 px-3.5 py-1.5 text-sm font-semibold text-[#9a632a] transition hover:bg-[#C8922A]/20";

  return (
    <section className={sectionClass}>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className={`mb-8 flex items-end justify-between gap-4 ${borderClass}`}>
          <h2 className={titleClass}>{title}</h2>
          {viewAllHref ? (
            <Link href={viewAllHref} scroll={viewAllScroll} className={viewAllClass}>
              {t("landing.viewAll")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
        <VaultProductGrid
          displayCards={displayCards}
          seriesMembersByKey={seriesMembersByKey}
          expandedSeriesKey={expandedSeriesKey}
          onToggleSeries={onToggleSeries}
          layout={layout}
          {...gridProps}
        />
      </div>
    </section>
  );
}
