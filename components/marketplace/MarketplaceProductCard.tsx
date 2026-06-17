"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Eye, GraduationCap, LayoutTemplate, Loader2, ShoppingCart, Zap } from "lucide-react";
import { VaultCountryMapIcon } from "@/components/marketplace/VaultCountryMapIcon";
import { displayVaultProductTitle, displayVaultPublisher } from "@/lib/marketplace-display";
import { isMarketplaceZip } from "@/lib/marketplace-zip-package";
import { marketplaceItemDetailHref } from "@/lib/marketplace-public-url";
import { coverObjectPosition, readItemCoverFocal } from "@/lib/marketplace-cover-framing";
import { canUseLawFirmAdvisoryWorkspace } from "@/lib/law-firm-advisory-preview";
import { advisoryCourseHref, isMarketplaceCourseItem } from "@/lib/marketplace-course";
import { VaultCoverImage } from "@/components/marketplace/VaultCoverImage";
import { VaultLanguageBadges } from "@/components/marketplace/VaultLanguageBadges";
import { resolveMarketplaceDisplayLanguageCodes } from "@/lib/marketplace-item-files";
import styles from "./MarketplaceProductCard.module.css";

const BRAND = {
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
};

const TYPE_THEMES: Record<string, { from: string; to: string; iconColor: string }> = {
  book: { from: "#4a3224", to: "#8b5e3c", iconColor: "#f5e8d8" },
  course: { from: "#152d4a", to: "#2a5080", iconColor: "#d8e8f8" },
  guide: { from: "#164a32", to: "#2d7a52", iconColor: "#dcf5e8" },
  template: { from: "#2a3140", to: "#4d5a6e", iconColor: "#e8edf4" },
};

function themeForType(type: string) {
  return TYPE_THEMES[type] ?? { from: BRAND.gradientStart, to: BRAND.gradientEnd, iconColor: "#fff8eb" };
}

export type MarketplaceProductCardProduct = {
  id: string;
  slug?: string | null;
  type: string;
  title: string;
  author: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  owned?: boolean;
  file_format?: string | null;
  file_name?: string | null;
  vault_subcategory?: string | null;
  focus_country?: string | null;
  is_course?: boolean;
  language_codes?: string[];
  cover_focal_x?: number | null;
  cover_focal_y?: number | null;
};

type MarketplaceProductCardProps = {
  product: MarketplaceProductCardProduct;
  typeBadgeLabel: string;
  seriesLabel?: string | null;
  collectionHref?: string | null;
  collectionCount?: number | null;
  collectionLabel?: string | null;
  isCollection?: boolean;
  showSeriesToggle?: boolean;
  collectionExpanded?: boolean;
  onCollectionToggle?: () => void;
  iconOnlyMedia?: boolean;
  isSignedIn: boolean;
  cartItemIds: Set<string>;
  addingToCart: string | null;
  onAddToCart: (productId: string, e: React.MouseEvent) => void;
  onRemoveFromCart: (productId: string, e: React.MouseEvent) => void;
  onBuy: (product: MarketplaceProductCardProduct, e: React.MouseEvent) => void;
  paidSeriesSummary?: {
    chargeCents: number;
    totalCents: number;
    bundleCents: number | null;
    bundleSavingsCents: number;
    ownedCount: number;
    itemCount: number;
    fullyOwned: boolean;
  } | null;
  onBuySeries?: (e: React.MouseEvent) => void;
  advisoryWorkspacePreview?: boolean;
  coverPriority?: boolean;
  /** When set, appended as `?from=` so item pages can navigate back to the collection. */
  returnTo?: string | null;
};

function CategoryIcon({ type, className }: { type: string; className?: string }) {
  const cn = className ?? "h-8 w-8";
  switch (type) {
    case "book":
      return <BookOpen className={cn} strokeWidth={1.5} />;
    case "course":
      return <GraduationCap className={cn} strokeWidth={1.5} />;
    case "guide":
      return <BookOpen className={cn} strokeWidth={1.5} />;
    case "template":
      return <LayoutTemplate className={cn} strokeWidth={1.5} />;
    default:
      return <BookOpen className={cn} strokeWidth={1.5} />;
  }
}

function formatUsd(cents: number, decimals = 2): string {
  return `$${(cents / 100).toFixed(decimals)}`;
}

export function MarketplaceProductCard({
  product,
  typeBadgeLabel,
  seriesLabel,
  collectionHref,
  collectionCount,
  collectionLabel,
  isCollection = false,
  showSeriesToggle = false,
  collectionExpanded = false,
  onCollectionToggle,
  iconOnlyMedia = false,
  isSignedIn,
  cartItemIds,
  addingToCart,
  onAddToCart,
  onRemoveFromCart,
  onBuy,
  paidSeriesSummary,
  onBuySeries,
  advisoryWorkspacePreview = false,
  coverPriority = false,
  returnTo,
}: MarketplaceProductCardProps) {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const [coverFailed, setCoverFailed] = useState(false);

  const isCollectionCard =
    isCollection || Boolean(collectionHref && collectionCount && collectionLabel);
  const isOwnedBadge = Boolean(product.owned || paidSeriesSummary?.fullyOwned);
  const hasSeriesBundleDiscount = Boolean(
    paidSeriesSummary &&
      paidSeriesSummary.bundleCents != null &&
      paidSeriesSummary.bundleSavingsCents > 0
  );
  const seriesListCents = paidSeriesSummary?.totalCents ?? 0;
  const seriesChargeCents = paidSeriesSummary
    ? paidSeriesSummary.ownedCount > 0
      ? paidSeriesSummary.chargeCents
      : (paidSeriesSummary.bundleCents ?? paidSeriesSummary.chargeCents)
    : 0;
  const useInlineCollection = showSeriesToggle && isCollectionCard && Boolean(onCollectionToggle);
  const displayTitle = isCollectionCard ? (collectionLabel as string) : displayVaultProductTitle(product.title);
  const subtitle = isCollectionCard
    ? t("resourcesCount", { count: collectionCount ?? 0 })
    : seriesLabel || displayVaultPublisher(product.author) || typeBadgeLabel;
  const href =
    collectionHref ||
    marketplaceItemDetailHref(
      {
        id: product.id,
        slug: product.slug,
        packagePage: isMarketplaceZip(product),
      },
      { returnTo }
    );
  const typeTheme = themeForType(product.type);
  const placeholderGradient = `linear-gradient(155deg, ${typeTheme.from} 0%, ${typeTheme.to} 100%)`;
  const hasCustomCover = Boolean(product.image_url?.trim()) && !coverFailed;
  const showCountryMap =
    !hasCustomCover && (iconOnlyMedia || Boolean(product.focus_country?.trim()));
  const showTypePlaceholder = !hasCustomCover && !showCountryMap;
  const coverFocalPosition = coverObjectPosition(readItemCoverFocal(product));

  const lawFirmHasWorkspaceAccess =
    isMarketplaceCourseItem(product) &&
    canUseLawFirmAdvisoryWorkspace(product.owned, advisoryWorkspacePreview);

  const showSeriesBuy =
    paidSeriesSummary && isCollectionCard && onBuySeries && !paidSeriesSummary.fullyOwned;

  const isInCart = cartItemIds.has(product.id);
  const isAddingThis = addingToCart === product.id;
  const showPurchaseActions =
    !isCollectionCard && !isOwnedBadge && !lawFirmHasWorkspaceAccess && product.price_cents > 0;
  const showFreeAction =
    !isCollectionCard && !isOwnedBadge && !lawFirmHasWorkspaceAccess && product.price_cents === 0;
  const showOwnedAction = !isCollectionCard && (isOwnedBadge || lawFirmHasWorkspaceAccess);

  const priceLabel =
    product.price_cents === 0
      ? t("free")
      : formatUsd(product.price_cents);
  const languageCodes = resolveMarketplaceDisplayLanguageCodes(
    { title: product.title, slug: product.slug },
    product.language_codes ?? []
  );
  const showLanguageFlairs = !isCollectionCard && languageCodes.length > 0;

  const navigate = () => router.push(href, { scroll: true });

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (useInlineCollection && onCollectionToggle) {
      onCollectionToggle();
      return;
    }
    navigate();
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    if (useInlineCollection && onCollectionToggle) {
      onCollectionToggle();
      return;
    }
    navigate();
  };

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <article
      className={`vault-product-card ${styles.card} ${useInlineCollection ? styles.cardCollection : ""} ${useInlineCollection && collectionExpanded ? styles.cardCollectionExpanded : ""}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role={useInlineCollection ? "button" : "link"}
      tabIndex={0}
      aria-label={displayTitle}
      aria-expanded={useInlineCollection ? collectionExpanded : undefined}
    >
      <div className={styles.media}>
        {hasCustomCover ? (
          <VaultCoverImage
            key={product.image_url!}
            src={product.image_url!}
            className={styles.cover}
            objectPosition={coverFocalPosition}
            priority={coverPriority}
            onError={() => setCoverFailed(true)}
          />
        ) : showCountryMap ? (
          <div className={styles.coverPlaceholder} style={{ background: placeholderGradient }}>
            <VaultCountryMapIcon focusCountry={product.focus_country} color={typeTheme.iconColor} />
          </div>
        ) : showTypePlaceholder ? (
          <div className={styles.coverPlaceholder} style={{ background: placeholderGradient }}>
            <CategoryIcon type={product.type} className="opacity-90" />
          </div>
        ) : null}
        {useInlineCollection ? (
          <div className={styles.collectionHover} aria-hidden>
            <Eye className="h-5 w-5" strokeWidth={1.75} />
            <span className={styles.collectionHoverLabel}>
              {collectionExpanded ? t("hideSeries") : t("showSeries")}
            </span>
          </div>
        ) : null}
        {isOwnedBadge ? (
          <div className={styles.mediaBadges}>
            <span className={styles.badgeOwned}>
              <Check className="h-3 w-3" aria-hidden />
              {t("owned")}
            </span>
          </div>
        ) : isCollectionCard ? (
          <div className={styles.mediaBadges}>
            <span className={styles.badgeCollection}>{t("collection")}</span>
          </div>
        ) : product.price_cents === 0 ? (
          <div className={styles.mediaBadges}>
            <span className={styles.badgeFree}>{t("free")}</span>
          </div>
        ) : null}
        {!isOwnedBadge && !isCollectionCard && product.price_cents > 0 ? (
          <span className={styles.priceBadge}>{priceLabel}</span>
        ) : null}
      </div>

      <div className={styles.body}>
        <h3 className={`vault-product-title ${styles.title}`} title={product.title}>
          {displayTitle}
        </h3>
        {showLanguageFlairs ? (
          <div className={styles.languageRow}>
            <VaultLanguageBadges languageCodes={languageCodes} variant="card" />
          </div>
        ) : null}
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}

        {showSeriesBuy ? (
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onBuySeries!(e);
            }}
            className={styles.seriesBuyBtn}
          >
            {paidSeriesSummary!.ownedCount > 0 ? (
              t("buyRemaining", { price: formatUsd(paidSeriesSummary!.chargeCents) })
            ) : hasSeriesBundleDiscount ? (
              <>
                {t("buyFullSeries", { price: formatUsd(seriesChargeCents) })}{" "}
                <span className={styles.strike}>{formatUsd(seriesListCents, 0)}</span>
              </>
            ) : (
              t("buyFullSeries", { price: formatUsd(seriesChargeCents) })
            )}
          </button>
        ) : isCollectionCard ? (
          <span className={styles.collectionCta}>{t("landing.exploreCollection")}</span>
        ) : showPurchaseActions ? (
          <div className={styles.actionRow}>
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                onBuy(product, e);
              }}
              disabled={isAddingThis}
              className={styles.btnPrimary}
            >
              {isAddingThis ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Zap className="h-3.5 w-3.5" aria-hidden />
              )}
              {t("buyNow")}
            </button>
            {isInCart ? (
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  onRemoveFromCart(product.id, e);
                }}
                disabled={isAddingThis}
                className={styles.btnSecondaryInCart}
              >
                {isAddingThis ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                )}
                {t("removeFromCart")}
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  onAddToCart(product.id, e);
                }}
                disabled={isAddingThis}
                className={styles.btnSecondary}
              >
                {isAddingThis ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
                )}
                {t("addToCart")}
              </button>
            )}
          </div>
        ) : showFreeAction ? (
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              navigate();
            }}
            className={styles.btnPrimary}
          >
            {t("getForFree")}
          </button>
        ) : showOwnedAction ? (
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              navigate();
            }}
            className={styles.btnSecondary}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {t("view")}
          </button>
        ) : null}
      </div>
    </article>
  );
}
