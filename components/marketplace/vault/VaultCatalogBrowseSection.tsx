"use client";

import { useTranslations } from "next-intl";
import { VaultProductGrid } from "./VaultProductGrid";
import type { MarketplaceBrowseItem } from "@/lib/marketplace-browse-data";
import type { MarketplaceProductCardProduct } from "@/components/marketplace/MarketplaceProductCard";
import type { VaultDisplayProductCard } from "@/lib/marketplace-vault-display-cards";
import type { VaultSubcategoryId } from "@/lib/marketplace-vault-categories";
import {
  vaultCatalogSectionLabelKey,
  type VaultCatalogSectionId,
} from "@/lib/marketplace-vault-catalog-sections";
import styles from "./VaultCatalogBrowseSection.module.css";

type VaultCatalogBrowseSectionProps = {
  sectionId: VaultCatalogSectionId;
  displayCards: VaultDisplayProductCard[];
  seriesMembersByKey: Map<string, MarketplaceBrowseItem[]>;
  expandedSeriesKey: string | null;
  onToggleSeries: (seriesKey: string) => void;
  isSignedIn: boolean;
  cartItemIds: Set<string>;
  addingToCart: string | null;
  advisoryWorkspacePreview: boolean;
  onAddToCart: (productId: string, e: React.MouseEvent) => void;
  onRemoveFromCart: (productId: string, e: React.MouseEvent) => void;
  onBuy: (product: MarketplaceProductCardProduct, e: React.MouseEvent) => void;
  onBuySeries: (seriesId: VaultSubcategoryId, e: React.MouseEvent) => void;
};

export function VaultCatalogBrowseSection({
  sectionId,
  displayCards,
  ...gridProps
}: VaultCatalogBrowseSectionProps) {
  const t = useTranslations("marketplace");

  if (displayCards.length === 0) return null;

  const labelKey = vaultCatalogSectionLabelKey(sectionId);

  return (
    <section className={styles.section} aria-labelledby={`vault-catalog-section-${sectionId}`}>
      <header className={styles.header}>
        <h2 id={`vault-catalog-section-${sectionId}`} className={styles.title}>
          {t(`formats.${labelKey}`)}
        </h2>
        <p className={styles.count}>{t("landing.resourceCount", { count: displayCards.length })}</p>
      </header>
      <VaultProductGrid
        displayCards={displayCards}
        layout="grid"
        cardVariant="browse"
        {...gridProps}
      />
    </section>
  );
}
