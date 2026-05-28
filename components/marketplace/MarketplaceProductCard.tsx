"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Eye, GraduationCap, LayoutTemplate, Loader2, Map } from "lucide-react";
import { displayVaultProductTitle } from "@/lib/marketplace-display";
import { isMarketplaceZip } from "@/lib/marketplace-zip-package";
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
};

function CategoryIcon({ type, className }: { type: string; className?: string }) {
  const cn = className ?? "h-3.5 w-3.5";
  switch (type) {
    case "book":
      return <BookOpen className={cn} strokeWidth={1.75} />;
    case "course":
      return <GraduationCap className={cn} strokeWidth={1.75} />;
    case "guide":
      return <Map className={cn} strokeWidth={1.75} />;
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
}: MarketplaceProductCardProps) {
  const router = useRouter();
  const [coverFailed, setCoverFailed] = useState(false);

  const priceLabel = product.price_cents === 0 ? "Free" : `$${(product.price_cents / 100).toFixed(2)}`;
  const isCollectionCard =
    isCollection || Boolean(collectionHref && collectionCount && collectionLabel);
  const useInlineCollection = isCollectionCard && Boolean(onCollectionToggle);
  const displayTitle = isCollectionCard ? (collectionLabel as string) : displayVaultProductTitle(product.title);
  const publisher = isCollectionCard
    ? `${collectionCount} resources`
    : product.author?.trim() || "Yamalé Alliance";
  const description = isCollectionCard
    ? `Browse all ${collectionLabel} resources in one place.`
    : plainDescription(product.description);
  const href = collectionHref || (isMarketplaceZip(product)
    ? `/marketplace/${product.id}/package`
    : `/marketplace/${product.id}`);
  const typeTheme = themeForType(product.type);
  const typeCardClass = styles[TYPE_CARD_CLASS[product.type] ?? "typeDefault"];
  const placeholderGradient = `linear-gradient(155deg, ${typeTheme.from} 0%, ${typeTheme.to} 100%)`;
  const tagLabel = isCollectionCard ? "Collection" : seriesLabel || typeBadgeLabel;
  const fileLabel = product.file_format ? `.${product.file_format.replace(/^\./, "")}` : null;

  const metaParts = [topicLabel, typeBadgeLabel, priceLabel, fileLabel].filter(Boolean);

  const showCartActions =
    !isCollectionCard && !product.owned && product.price_cents > 0 && !isMarketplaceZip(product);

  const showPackageCta =
    !isCollectionCard && !product.owned && isMarketplaceZip(product);

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
        {iconOnlyMedia || !(product.image_url && !coverFailed) ? (
          <div className={styles.coverPlaceholder} style={{ background: placeholderGradient }}>
            <span style={{ color: typeTheme.iconColor }}>
              <CategoryIcon type={product.type} className="h-8 w-8" />
            </span>
          </div>
        ) : product.image_url && !coverFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={product.image_url}
            src={product.image_url}
            alt=""
            className={styles.cover}
            loading="lazy"
            decoding="async"
            onError={() => setCoverFailed(true)}
          />
        ) : null}
        {useInlineCollection ? (
          <div className={styles.collectionHover} aria-hidden>
            <Eye className="h-6 w-6" strokeWidth={1.75} />
            <span className={styles.collectionHoverLabel}>
              {collectionExpanded ? "Hide series" : "Show series"}
            </span>
          </div>
        ) : null}
        {product.owned ? (
          <span className={styles.badgeOwned}>
            <Check className="h-3 w-3" aria-hidden />
            Owned
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
            {[metaParts.join(" · "), formatHint].filter(Boolean).join(" · ")}
          </p>
          {tagLabel ? <span className={styles.tag}>{tagLabel}</span> : null}
        </div>

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
              {product.price_cents === 0 ? "Get package" : `View · ${priceLabel}`}
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
