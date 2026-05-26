"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, FileText, GraduationCap, LayoutTemplate, Loader2, Map } from "lucide-react";
import { displayVaultProductTitle } from "@/lib/marketplace-display";
import { isMarketplaceZip } from "@/lib/marketplace-zip-package";
import styles from "./MarketplaceProductCard.module.css";

const BRAND = {
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
};

/** Distinct back-face palettes per vault product type. */
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
  isSignedIn: boolean;
  cartItemIds: Set<string>;
  addingToCart: string | null;
  onAddToCart: (productId: string, e: React.MouseEvent) => void;
  onRemoveFromCart: (productId: string, e: React.MouseEvent) => void;
  onBuy: (product: MarketplaceProductCardProduct, e: React.MouseEvent) => void;
};

function CategoryIcon({ type, className }: { type: string; className?: string }) {
  const cn = className ?? "h-10 w-10";
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

const DEFAULT_BACK_DESCRIPTION =
  "Open for the full overview, contents, and download or purchase options.";

export function MarketplaceProductCard({
  product,
  topicLabel,
  typeBadgeLabel,
  formatHint,
  seriesLabel,
  isSignedIn,
  cartItemIds,
  addingToCart,
  onAddToCart,
  onRemoveFromCart,
  onBuy,
}: MarketplaceProductCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const descCleanup = useRef<(() => void) | null>(null);

  const priceLabel = product.price_cents === 0 ? "Free" : `$${(product.price_cents / 100).toFixed(2)}`;
  const displayTitle = displayVaultProductTitle(product.title);
  const href = isMarketplaceZip(product)
    ? `/marketplace/${product.id}/package`
    : `/marketplace/${product.id}`;
  const backDescription =
    product.description?.trim() || DEFAULT_BACK_DESCRIPTION;
  const typeTheme = themeForType(product.type);
  const backGradient = `linear-gradient(155deg, ${typeTheme.from} 0%, ${typeTheme.to} 100%)`;

  const descriptionRef = useCallback(
    (el: HTMLParagraphElement | null) => {
      descCleanup.current?.();
      descCleanup.current = null;
      if (!el) return;
      const check = () => {
        if (expanded) {
          setOverflows(false);
          return;
        }
        setOverflows(el.scrollHeight > el.clientHeight + 1);
      };
      const ro = new ResizeObserver(check);
      ro.observe(el);
      check();
      descCleanup.current = () => ro.disconnect();
    },
    [expanded, backDescription]
  );

  const navigate = () => router.push(href);

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (expanded) return;
    navigate();
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    if (!expanded) navigate();
  };

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className={`vault-product-card ${styles.card} ${expanded ? styles.cardExpanded : ""}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role="link"
      tabIndex={0}
      aria-label={displayTitle}
    >
      <div className={styles.flipStage}>
        <div className={styles.flipper}>
          <div className={`${styles.face} ${styles.faceFront}`}>
            <div className={styles.frontMedia}>
              {product.image_url && !coverFailed ? (
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
              ) : (
                <div className={styles.coverPlaceholder} style={{ background: backGradient }}>
                  <span style={{ color: typeTheme.iconColor }}>
                    <CategoryIcon type={product.type} className="h-14 w-14" />
                  </span>
                </div>
              )}
            </div>
            <span className={styles.frontPrice}>{priceLabel}</span>
            {product.owned ? (
              <span className={styles.frontOwned}>
                <Check className="h-3 w-3" aria-hidden />
                Owned
              </span>
            ) : null}
          </div>

          <div
            className={`${styles.face} ${styles.faceBack}`}
            style={{ background: backGradient }}
          >
            <span className={styles.backTag}>{typeBadgeLabel}</span>
          <div className={styles.backMain}>
            <div className={styles.backIconWrap} style={{ color: typeTheme.iconColor }}>
              <CategoryIcon type={product.type} className="h-12 w-12" />
            </div>
            <p
              ref={descriptionRef}
              className={`${styles.backDescription} ${expanded ? styles.backDescriptionExpanded : ""}`}
            >
              {backDescription}
            </p>
            {(overflows || expanded) && (
              <button
                type="button"
                className={styles.readMore}
                onClick={(e) => {
                  stop(e);
                  setExpanded((v) => !v);
                }}
              >
                {expanded ? "Read less" : "Read more"}
              </button>
            )}
          </div>
          <div className={styles.backFooter}>
            <span className={styles.backMeta}>
              {topicLabel}
              {seriesLabel ? ` · ${seriesLabel}` : ""}
              {` · ${formatHint}`}
            </span>
            <div className={styles.backActions}>
              {isMarketplaceZip(product) && !product.owned && (
                <span className={styles.backActionHint}>
                  View package
                  {product.price_cents === 0 ? " · Free" : ""}
                </span>
              )}
              {isSignedIn && !product.owned && product.price_cents > 0 && !isMarketplaceZip(product) && (
                <>
                  {cartItemIds.has(product.id) ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        stop(e);
                        onRemoveFromCart(product.id, e);
                      }}
                      disabled={addingToCart === product.id}
                      className={styles.backBtnSecondary}
                    >
                      {addingToCart === product.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Remove"
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
                      className={styles.backBtnSecondary}
                    >
                      {addingToCart === product.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Add"
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      onBuy(product, e);
                    }}
                    className={styles.backBtnPrimary}
                  >
                    Buy
                  </button>
                </>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
      <div className={styles.frontCaption}>
        <h3 className={`vault-product-title ${styles.frontTitle}`} title={product.title}>
          {displayTitle}
        </h3>
        {seriesLabel ? <p className={styles.frontSeries}>{seriesLabel}</p> : null}
      </div>
    </div>
  );
}
