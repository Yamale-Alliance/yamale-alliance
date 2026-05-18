"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, Check, FileText, GraduationCap, Loader2 } from "lucide-react";
import { displayVaultProductTitle } from "@/lib/marketplace-display";
import { isMarketplaceZip } from "@/lib/marketplace-zip-package";

const BRAND = {
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
};

export type MarketplaceProductCardProduct = {
  id: string;
  type: string;
  title: string;
  author: string;
  price_cents: number;
  image_url: string | null;
  owned?: boolean;
  file_format?: string | null;
  file_name?: string | null;
};

type MarketplaceProductCardProps = {
  product: MarketplaceProductCardProduct;
  topicLabel: string;
  typeBadgeLabel: string;
  formatHint: string;
  isSignedIn: boolean;
  cartItemIds: Set<string>;
  addingToCart: string | null;
  onAddToCart: (productId: string, e: React.MouseEvent) => void;
  onRemoveFromCart: (productId: string, e: React.MouseEvent) => void;
  onBuy: (product: MarketplaceProductCardProduct, e: React.MouseEvent) => void;
};

function CategoryIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "book":
      return <BookOpen className={className ?? "h-9 w-9"} />;
    case "course":
      return <GraduationCap className={className ?? "h-9 w-9"} />;
    default:
      return <FileText className={className ?? "h-9 w-9"} />;
  }
}

export function MarketplaceProductCard({
  product,
  topicLabel,
  typeBadgeLabel,
  formatHint,
  isSignedIn,
  cartItemIds,
  addingToCart,
  onAddToCart,
  onRemoveFromCart,
  onBuy,
}: MarketplaceProductCardProps) {
  const priceLabel = product.price_cents === 0 ? "Free" : `$${(product.price_cents / 100).toFixed(2)}`;
  const displayTitle = displayVaultProductTitle(product.title);
  const href = isMarketplaceZip(product)
    ? `/marketplace/${product.id}/package`
    : `/marketplace/${product.id}`;

  return (
    <Link
      href={href}
      className="vault-product-card group flex h-full flex-col overflow-hidden rounded-[10px] border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className="relative h-36 shrink-0 border-b border-border"
        style={{ background: `linear-gradient(135deg, ${BRAND.gradientStart}, ${BRAND.gradientEnd})` }}
      >
        {product.image_url ? (
          <Image src={product.image_url} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, 25vw" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/95">
            <CategoryIcon type={product.type} className="h-9 w-9" />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <span className="rounded-full bg-[#0D1B2A] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {typeBadgeLabel}
          </span>
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#0D1B2A]">
          {priceLabel}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-[1.125rem]">
        <h3
          className="vault-product-title line-clamp-3 font-sans text-[15px] font-semibold leading-snug tracking-normal text-foreground"
          title={product.title}
        >
          {displayTitle}
        </h3>
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
                    onClick={(e) => onRemoveFromCart(product.id, e)}
                    disabled={addingToCart === product.id}
                    className="rounded-[6px] border border-red-300 px-2 py-1 text-[11px] font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    {addingToCart === product.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => onAddToCart(product.id, e)}
                    disabled={addingToCart === product.id}
                    className="rounded-[6px] border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    {addingToCart === product.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => onBuy(product, e)}
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
    </Link>
  );
}
