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

/** Distinct front-face palettes per vault product type (cover image is back-only). */
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
  "Open this resource for the full overview, contents, and download or purchase options.";

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
    >
      <div className={styles.flipper}>
        <div className={`${styles.face} ${styles.faceFront}`}>
          <div
            className={styles.frontHeader}
            style={{ background: `linear-gradient(145deg, ${typeTheme.from}, ${typeTheme.to})` }}
          >
            <div className={styles.frontIconWrap} style={{ color: typeTheme.iconColor }}>
              <CategoryIcon type={product.type} className="h-11 w-11" />
            </div>
            <div className="absolute left-3 top-3">
              <span className="rounded-full bg-[#0D1B2A] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                {typeBadgeLabel}
              </span>
            </div>
            <div className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#0D1B2A]">
              {priceLabel}
            </div>
          </div>

          <div className={styles.frontBody}>
            <h3
              className="vault-product-title line-clamp-3 font-sans text-[15px] font-semibold leading-snug tracking-normal text-foreground"
              title={product.title}
            >
              {displayTitle}
            </h3>
            {seriesLabel ? (
              <p className="mt-1.5 font-sans text-[11px] font-semibold text-[#b8893b]">{seriesLabel}</p>
            ) : null}
            <p className="mt-2 font-sans text-xs leading-relaxed text-muted-foreground">
              {product.author || "Yamale Faculty"}
              {product.owned ? <span> · Owned</span> : null}
            </p>
            <p className="mt-1 font-sans text-[11px] text-muted-foreground/85">{formatHint}</p>

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
              <span className="truncate font-sans text-xs font-medium text-muted-foreground">{topicLabel}</span>
              <div className="flex shrink-0 items-center gap-2">
                {isMarketplaceZip(product) && !product.owned && (
                  <span className="rounded-[6px] border border-[#C8922A]/40 bg-[#C8922A]/10 px-2 py-1 text-[11px] font-semibold text-[#b8893b]">
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
                        className="rounded-[6px] border border-red-300 px-2 py-1 text-[11px] font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {addingToCart === product.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          stop(e);
                          onAddToCart(product.id, e);
                        }}
                        disabled={addingToCart === product.id}
                        className="rounded-[6px] border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                      >
                        {addingToCart === product.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        stop(e);
                        onBuy(product, e);
                      }}
                      className="rounded-[6px] bg-[#0D1B2A] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#162436]"
                    >
                      Buy
                    </button>
                  </>
                )}
                {product.owned && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                    <Check className="h-3 w-3" aria-hidden />
                    Owned
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.face} ${styles.faceBack}`}>
          <div className={styles.backMedia}>
            {product.image_url && !coverFailed ? (
              // Native img: Next/Image `fill` often fails inside CSS 3D flip (backface-hidden).
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
              <div
                className={styles.coverPlaceholder}
                style={{ background: `linear-gradient(145deg, ${typeTheme.from}, ${typeTheme.to})` }}
              >
                <span style={{ color: typeTheme.iconColor }}>
                  <CategoryIcon type={product.type} className="h-10 w-10" />
                </span>
              </div>
            )}
          </div>
          <div className={styles.overlay} aria-hidden />
          <span className={styles.backTag}>{typeBadgeLabel}</span>
          <div className={styles.backBody}>
            <h3 className={styles.backTitle}>{displayTitle}</h3>
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
            <p className={styles.backMeta}>
              {priceLabel}
              {seriesLabel ? ` · ${seriesLabel}` : ""}
              {` · ${formatHint}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
