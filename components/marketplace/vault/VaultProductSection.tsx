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
import styles from "./VaultProductSection.module.css";

const SECTION_HINT_KEYS: Record<string, string> = {
  "landing.sectionFeatured": "formats.allBlurb",
  "landing.sectionSeries": "formats.seriesBlurb",
  "landing.sectionFree": "formats.freeBlurb",
  "landing.sectionCourses": "formats.courseBlurb",
  "landing.sectionTemplates": "formats.templateBlurb",
  "landing.sectionBooks": "formats.bookBlurb",
  "landing.sectionGuides": "formats.guideBlurb",
};

const SECTION_EYEBROW_KEYS: Record<string, string> = {
  "landing.sectionFeatured": "formats.all",
  "landing.sectionSeries": "formats.series",
  "landing.sectionFree": "formats.free",
  "landing.sectionCourses": "formats.course",
  "landing.sectionTemplates": "formats.template",
  "landing.sectionBooks": "formats.book",
  "landing.sectionGuides": "formats.guide",
};

type VaultProductSectionProps = {
  sectionKey?: string;
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
  sectionKey,
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

  const sectionToneClass =
    variant === "series"
      ? styles.sectionSeries
      : muted
        ? styles.sectionMuted
        : styles.sectionDefault;

  const hintKey = sectionKey ? SECTION_HINT_KEYS[sectionKey] : undefined;
  const eyebrowKey = sectionKey ? SECTION_EYEBROW_KEYS[sectionKey] : undefined;
  const hint = hintKey ? t(hintKey) : null;
  const eyebrow = eyebrowKey ? t(eyebrowKey) : null;

  return (
    <section className={`${styles.section} ${sectionToneClass}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.headerMain}>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            <h2 className={styles.title}>{title}</h2>
            {hint ? <p className={styles.hint}>{hint}</p> : null}
          </div>
          {viewAllHref ? (
            <Link href={viewAllHref} scroll={viewAllScroll} className={styles.viewAll}>
              {t("landing.viewAll")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </header>
        <div className={styles.railTrack}>
          <VaultProductGrid
            displayCards={displayCards}
            seriesMembersByKey={seriesMembersByKey}
            expandedSeriesKey={expandedSeriesKey}
            onToggleSeries={onToggleSeries}
            layout={layout}
            {...gridProps}
          />
        </div>
      </div>
    </section>
  );
}
