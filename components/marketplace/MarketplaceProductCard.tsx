"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Eye, GraduationCap, LayoutTemplate, Loader2 } from "lucide-react";
import { VaultCountryMapIcon } from "@/components/marketplace/VaultCountryMapIcon";
import { LawFirmPackageDiscountPrice } from "@/components/marketplace/LawFirmPackageDiscountPrice";
import { displayVaultProductTitle } from "@/lib/marketplace-display";
import { isMarketplaceZip } from "@/lib/marketplace-zip-package";
import { marketplaceItemDetailHref } from "@/lib/marketplace-public-url";
import { canUseLawFirmAdvisoryWorkspace } from "@/lib/law-firm-advisory-preview";
import { advisoryCourseHref, isMarketplaceCourseItem } from "@/lib/marketplace-course";
import {
  LAW_FIRM_VIEW_COURSE_LABEL,
  shouldShowLawFirmPackageMarketingDiscount,
} from "@/lib/law-firm-package-marketing";
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

const TYPE_CARD_CLASS: Record<string, string> = {
  book: "typeBook",
  course: "typeCourse",
  guide: "typeGuide",
  template: "typeTemplate",
};

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
};

type MarketplaceProductCardProps = {
  product: MarketplaceProductCardProduct;
  topicLabel: string;
  typeBadgeLabel: string;
  formatHint: string;
  seriesLabel?: string | null;
  collectionHref?: string | null;
  collectionCount?: number | null;
  collectionLabel?: string | null;
  /** Inline series expand (collection card stays visible). */
  isCollection?: boolean;
  collectionExpanded?: boolean;
  onCollectionToggle?: () => void;
  /** Series member tiles: icon only, no cover image. */
  iconOnlyMedia?: boolean;
  isSignedIn: boolean;
  cartItemIds: Set<string>;
  addingToCart: string | null;
  onAddToCart: (productId: string, e: React.MouseEvent) => void;
  onRemoveFromCart: (productId: string, e: React.MouseEvent) => void;
  onBuy: (product: MarketplaceProductCardProduct, e: React.MouseEvent) => void;
  /** Paid series collection card — buy remaining items at bundle / prorated price. */
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
  /** From GET /api/marketplace — server reads ADVISORY_WORKSPACE_PREVIEW env. */
  advisoryWorkspacePreview?: boolean;
};

function CategoryIcon({ type, className }: { type: string; className?: string }) {
  const cn = className ?? "h-3.5 w-3.5";
  switch (type) {
    case "book":
      return <BookOpen className={cn} strokeWidth={1.75} />;
    case "course":
      return <GraduationCap className={cn} strokeWidth={1.75} />;
    case "guide":
      return <BookOpen className={cn} strokeWidth={1.75} />;
    case "template":
      return <LayoutTemplate className={cn} strokeWidth={1.75} />;
    default:
      return <BookOpen className={cn} strokeWidth={1.75} />;
  }
}

function plainDescription(raw: string | null): string {
  const fallback = "View overview, contents, and download or purchase options.";
  if (!raw?.trim()) return fallback;
  const text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

export function MarketplaceProductCard({
  product,
  topicLabel,
  typeBadgeLabel,
  formatHint,
  seriesLabel,
  collectionHref,
  collectionCount,
  collectionLabel,
  isCollection = false,
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
}: MarketplaceProductCardProps) {
  const router = useRouter();
  const [coverFailed, setCoverFailed] = useState(false);

  const priceLabel = product.price_cents === 0 ? "Free" : `$${(product.price_cents / 100).toFixed(2)}`;
  const showLawFirmDiscount = shouldShowLawFirmPackageMarketingDiscount(product);
  const isCollectionCard =
    isCollection || Boolean(collectionHref && collectionCount && collectionLabel);
  const useInlineCollection = isCollectionCard && Boolean(onCollectionToggle);
  const displayTitle = isCollectionCard ? (collectionLabel as string) : displayVaultProductTitle(product.title);
  const publisher = isCollectionCard
    ? `${collectionCount} resources`
    : product.author?.trim() || "Yamalé Alliance";
  const description = isCollectionCard
    ? paidSeriesSummary
      ? paidSeriesSummary.bundleCents != null && paidSeriesSummary.bundleSavingsCents > 0
        ? `${collectionCount} pack · series bundle $${(paidSeriesSummary.bundleCents / 100).toFixed(2)} (list $${(paidSeriesSummary.totalCents / 100).toFixed(2)})`
        : `${collectionCount} pack · complete series $${(paidSeriesSummary.totalCents / 100).toFixed(2)}`
      : `Browse all ${collectionLabel} resources in one place.`
    : plainDescription(product.description);
  const href =
    collectionHref ||
    marketplaceItemDetailHref({
      id: product.id,
      slug: product.slug,
      packagePage: isMarketplaceZip(product),
    });
  const typeTheme = themeForType(product.type);
  const typeCardClass = styles[TYPE_CARD_CLASS[product.type] ?? "typeDefault"];
  const placeholderGradient = `linear-gradient(155deg, ${typeTheme.from} 0%, ${typeTheme.to} 100%)`;
  const hasCustomCover = Boolean(product.image_url?.trim()) && !coverFailed;
  const showCountryMap =
    !hasCustomCover && (iconOnlyMedia || Boolean(product.focus_country?.trim()));
  const showTypePlaceholder = !hasCustomCover && !showCountryMap;
  const tagLabel = isCollectionCard ? "Collection" : seriesLabel || typeBadgeLabel;
  const fileLabel = product.file_format ? `.${product.file_format.replace(/^\./, "")}` : null;

  const metaParts = (
    showLawFirmDiscount
      ? [topicLabel, typeBadgeLabel, fileLabel]
      : [topicLabel, typeBadgeLabel, priceLabel, fileLabel]
  ).filter(Boolean);

  const showCartActions =
    !isCollectionCard && !product.owned && product.price_cents > 0 && !isMarketplaceZip(product);

  const courseWorkspaceHref = advisoryCourseHref(product);
  const lawFirmHasWorkspaceAccess =
    isMarketplaceCourseItem(product) &&
    canUseLawFirmAdvisoryWorkspace(product.owned, advisoryWorkspacePreview);

  const showPackageCta =
    !isCollectionCard && !lawFirmHasWorkspaceAccess && isMarketplaceZip(product);

  const showLawFirmWorkspaceCta = !isCollectionCard && lawFirmHasWorkspaceAccess;

  const navigate = () => router.push(href);

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
      className={`vault-product-card ${styles.card} ${typeCardClass} ${useInlineCollection ? styles.cardCollection : ""} ${collectionExpanded ? styles.cardCollectionExpanded : ""}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role={useInlineCollection ? "button" : "link"}
      tabIndex={0}
      aria-label={displayTitle}
      aria-expanded={useInlineCollection ? collectionExpanded : undefined}
    >
      <div className={styles.media}>
        {hasCustomCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={product.image_url!}
            src={product.image_url!}
            alt=""
            className={styles.cover}
            loading="lazy"
            decoding="async"
            onError={() => setCoverFailed(true)}
          />
        ) : showCountryMap ? (
          <div className={styles.coverPlaceholder} style={{ background: placeholderGradient }}>
            <VaultCountryMapIcon focusCountry={product.focus_country} color={typeTheme.iconColor} />
          </div>
        ) : showTypePlaceholder ? (
          <div className={styles.coverPlaceholder} style={{ background: placeholderGradient }}>
            <CategoryIcon type={product.type} className="h-10 w-10 opacity-90" />
          </div>
        ) : null}
        {useInlineCollection ? (
          <div className={styles.collectionHover} aria-hidden>
            <Eye className="h-6 w-6" strokeWidth={1.75} />
            <span className={styles.collectionHoverLabel}>
              {collectionExpanded ? "Hide series" : "Show series"}
            </span>
          </div>
        ) : null}
        {product.owned || paidSeriesSummary?.fullyOwned ? (
          <span className={styles.badgeOwned}>
            <Check className="h-3 w-3" aria-hidden />
            Owned
          </span>
        ) : paidSeriesSummary && isCollectionCard ? (
          <span className={styles.badgePrice}>
            {paidSeriesSummary.ownedCount > 0
              ? `$${(paidSeriesSummary.chargeCents / 100).toFixed(2)} series`
              : paidSeriesSummary.bundleCents != null && paidSeriesSummary.bundleSavingsCents > 0
                ? `$${(paidSeriesSummary.bundleCents / 100).toFixed(2)} series`
                : `$${(paidSeriesSummary.chargeCents / 100).toFixed(2)} series`}
          </span>
        ) : showLawFirmDiscount ? (
          <span className={`${styles.badgePrice} ${styles.badgePriceDiscount}`}>
            <LawFirmPackageDiscountPrice saleCents={product.price_cents} size="compact" />
          </span>
        ) : (
          <span className={styles.badgePrice}>{priceLabel}</span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.publisher}>
          <span className={styles.publisherIcon} style={{ color: typeTheme.iconColor }}>
            <CategoryIcon type={product.type} />
          </span>
          <span className={styles.publisherName}>{publisher}</span>
        </div>

        <h3 className={`vault-product-title ${styles.title}`} title={product.title}>
          {displayTitle}
        </h3>

        <p className={styles.description}>{description}</p>

        <div className={styles.footer}>
          <p className={styles.meta}>
            {metaParts.join(" · ")}
            {showLawFirmDiscount ? (
              <>
                {metaParts.length > 0 ? " · " : null}
                <LawFirmPackageDiscountPrice saleCents={product.price_cents} size="inline" />
              </>
            ) : null}
            {formatHint ? `${metaParts.length > 0 || showLawFirmDiscount ? " · " : ""}${formatHint}` : null}
          </p>
          {tagLabel ? <span className={styles.tag}>{tagLabel}</span> : null}
        </div>

        {paidSeriesSummary && isCollectionCard && onBuySeries && !paidSeriesSummary.fullyOwned ? (
          <div className={styles.actions}>
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                onBuySeries(e);
              }}
              className={styles.actionBtnPrimary}
              style={{ flex: "1 1 100%" }}
            >
              {paidSeriesSummary.ownedCount > 0 ? (
                <>Buy full series · ${(paidSeriesSummary.chargeCents / 100).toFixed(2)}</>
              ) : paidSeriesSummary.bundleCents != null && paidSeriesSummary.bundleSavingsCents > 0 ? (
                <>
                  Buy full series · ${(paidSeriesSummary.bundleCents / 100).toFixed(2)}{" "}
                  <span className="text-white/75 line-through">${(paidSeriesSummary.totalCents / 100).toFixed(0)}</span>
                </>
              ) : (
                <>Buy full series · ${(paidSeriesSummary.chargeCents / 100).toFixed(2)}</>
              )}
            </button>
          </div>
        ) : null}

        {showLawFirmWorkspaceCta ? (
          <div className={styles.actions}>
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                navigate();
              }}
              className={styles.actionBtn}
            >
              View
            </button>
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                router.push(courseWorkspaceHref);
              }}
              className={styles.actionBtnPrimary}
            >
              {LAW_FIRM_VIEW_COURSE_LABEL}
            </button>
          </div>
        ) : null}

        {showPackageCta ? (
          <div className={styles.actions}>
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                navigate();
              }}
              className={styles.actionBtnPrimary}
              style={{ flex: "1 1 100%" }}
            >
              {product.price_cents === 0 ? (
                "Get package"
              ) : showLawFirmDiscount ? (
                <span className="inline-flex items-center justify-center gap-1.5">
                  View ·{" "}
                  <LawFirmPackageDiscountPrice
                    saleCents={product.price_cents}
                    size="inline"
                    className="text-white [&_span:first-child]:text-white/70 [&_span:nth-child(2)]:text-white"
                  />
                </span>
              ) : (
                `View · ${priceLabel}`
              )}
            </button>
          </div>
        ) : null}

        {showCartActions ? (
          <div className={styles.actions}>
            {cartItemIds.has(product.id) ? (
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  onRemoveFromCart(product.id, e);
                }}
                disabled={addingToCart === product.id}
                className={styles.actionBtn}
              >
                {addingToCart === product.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Remove from cart"
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  onAddToCart(product.id, e);
                }}
                disabled={addingToCart === product.id}
                className={styles.actionBtn}
              >
                {addingToCart === product.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Add to cart"
                )}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                onBuy(product, e);
              }}
              className={styles.actionBtnPrimary}
            >
              Buy
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
