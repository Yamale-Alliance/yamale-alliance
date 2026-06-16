"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { MarketplaceProductCard } from "@/components/marketplace/MarketplaceProductCard";
import { VaultSeriesCard } from "@/components/marketplace/vault/VaultSeriesCard";
import { computeSeriesOfferFromBrowseItems } from "@/lib/marketplace-series-offers";
import {
  isFreeVaultItem,
  isPaidVaultSubcategory,
  labelForVaultSubcategory,
  vaultSeriesUsesPerCountryCovers,
  type VaultSubcategoryId,
} from "@/lib/marketplace-vault-categories";
import { parseVaultSeriesGroupKey } from "@/lib/marketplace-vault-series-display";
import type { MarketplaceBrowseItem } from "@/lib/marketplace-browse-data";
import type { MarketplaceProductCardProduct } from "@/components/marketplace/MarketplaceProductCard";
import type { VaultDisplayProductCard } from "@/lib/marketplace-vault-display-cards";

type VaultProductGridProps = {
  displayCards: VaultDisplayProductCard[];
  seriesMembersByKey: Map<string, MarketplaceBrowseItem[]>;
  expandedSeriesKey: string | null;
  onToggleSeries: (seriesKey: string) => void;
  layout?: "grid" | "rail";
  isSignedIn: boolean;
  cartItemIds: Set<string>;
  addingToCart: string | null;
  advisoryWorkspacePreview: boolean;
  onAddToCart: (productId: string, e: React.MouseEvent) => void;
  onRemoveFromCart: (productId: string, e: React.MouseEvent) => void;
  onBuy: (product: MarketplaceProductCardProduct, e: React.MouseEvent) => void;
  onBuySeries: (seriesId: VaultSubcategoryId, e: React.MouseEvent) => void;
};

export function VaultProductGrid({
  displayCards,
  seriesMembersByKey,
  expandedSeriesKey,
  onToggleSeries,
  layout = "grid",
  isSignedIn,
  cartItemIds,
  addingToCart,
  advisoryWorkspacePreview,
  onAddToCart,
  onRemoveFromCart,
  onBuy,
  onBuySeries,
}: VaultProductGridProps) {
  const t = useTranslations("marketplace");

  const renderProductCard = (
    product: MarketplaceBrowseItem,
    card: VaultDisplayProductCard,
    cardIndex: number,
    opts?: { iconOnlyMedia?: boolean; keySuffix?: string; seriesMember?: boolean }
  ) => {
    const seriesKey = card.seriesKey;
    const isInlineCollection = Boolean(seriesKey && card.collectionLabel);
    const isSeriesMember = Boolean(opts?.seriesMember);
    const useCollectionChrome =
      isInlineCollection && !opts?.iconOnlyMedia && !isSeriesMember;
    const useInlineExpand = useCollectionChrome && layout === "grid" && !card.collectionHref;
    const expanded = useInlineExpand && expandedSeriesKey === seriesKey;
    const paidSeriesSummary =
      seriesKey && useCollectionChrome
        ? (() => {
            const { subcategory } = parseVaultSeriesGroupKey(seriesKey);
            if (!isPaidVaultSubcategory(subcategory)) return null;
            const seriesMembers = seriesMembersByKey.get(seriesKey) ?? [];
            const offer = computeSeriesOfferFromBrowseItems(
              subcategory as VaultSubcategoryId,
              seriesMembers
            );
            if (!offer) return null;
            return {
              chargeCents: offer.chargeCents,
              totalCents: offer.totalCents,
              bundleCents: offer.bundleCents,
              bundleSavingsCents: offer.bundleSavingsCents,
              ownedCount: offer.ownedCount,
              itemCount: offer.itemCount,
              fullyOwned: offer.fullyOwned,
            };
          })()
        : null;

    return (
      <MarketplaceProductCard
        key={`${product.id}${opts?.keySuffix ?? ""}`}
        product={product}
        typeBadgeLabel={
          product.type === "course"
            ? t("typeBadges.course")
            : product.type === "guide"
              ? t("typeBadges.guide")
              : product.type === "template"
                ? t("typeBadges.template")
                : t("typeBadges.book")
        }
        seriesLabel={
          opts?.iconOnlyMedia
            ? null
            : isSeriesMember
              ? labelForVaultSubcategory(product.vault_subcategory)
              : isFreeVaultItem(product.price_cents)
                ? labelForVaultSubcategory(product.vault_subcategory)
                : null
        }
        collectionHref={card.collectionHref}
        collectionCount={useCollectionChrome ? card.collectionCount : undefined}
        collectionLabel={useCollectionChrome ? card.collectionLabel : undefined}
        isCollection={useCollectionChrome}
        showSeriesToggle={useInlineExpand}
        collectionExpanded={useInlineExpand ? expanded : false}
        onCollectionToggle={useInlineExpand ? () => onToggleSeries(seriesKey!) : undefined}
        iconOnlyMedia={opts?.iconOnlyMedia}
        isSignedIn={isSignedIn}
        cartItemIds={cartItemIds}
        addingToCart={addingToCart}
        onAddToCart={onAddToCart}
        onRemoveFromCart={onRemoveFromCart}
        onBuy={onBuy}
        advisoryWorkspacePreview={advisoryWorkspacePreview}
        paidSeriesSummary={useCollectionChrome ? paidSeriesSummary : undefined}
        onBuySeries={
          useCollectionChrome && paidSeriesSummary && seriesKey
            ? (e) =>
                onBuySeries(
                  parseVaultSeriesGroupKey(seriesKey).subcategory as VaultSubcategoryId,
                  e
                )
            : undefined
        }
        coverPriority={cardIndex < 8 && !opts?.iconOnlyMedia}
      />
    );
  };

  const containerClass =
    layout === "rail"
      ? "flex gap-5 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin"
      : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  const itemClass =
    layout === "rail"
      ? "w-[220px] shrink-0 snap-start sm:w-[240px]"
      : "";

  const renderSeriesCard = (card: VaultDisplayProductCard, cardIndex: number) => {
    const seriesKey = card.seriesKey;
    if (!seriesKey || !card.collectionHref || !card.collectionLabel) return null;
    const { subcategory } = parseVaultSeriesGroupKey(seriesKey);
    const members = seriesMembersByKey.get(seriesKey) ?? [];
    const offer =
      isPaidVaultSubcategory(subcategory) && members.length > 0
        ? computeSeriesOfferFromBrowseItems(subcategory as VaultSubcategoryId, members)
        : null;
    const priceCents =
      offer && !offer.fullyOwned
        ? offer.ownedCount > 0
          ? offer.chargeCents
          : (offer.bundleCents ?? offer.chargeCents)
        : members.every((member) => isFreeVaultItem(member.price_cents))
          ? 0
          : null;

    return (
      <VaultSeriesCard
        title={card.collectionLabel}
        coverUrl={card.product.image_url}
        resourceCount={card.collectionCount ?? members.length}
        href={card.collectionHref}
        priceCents={priceCents}
        listPriceCents={
          offer?.bundleCents != null && offer.bundleSavingsCents > 0 ? offer.totalCents : null
        }
        coverPriority={cardIndex < 6}
      />
    );
  };

  return (
    <div className={containerClass}>
      {displayCards.map((card, cardIndex) => {
        const seriesKey = card.seriesKey;
        const isInlineCollection = Boolean(seriesKey && card.collectionLabel);
        const expanded = isInlineCollection && expandedSeriesKey === seriesKey;
        const members = seriesKey && expanded ? (seriesMembersByKey.get(seriesKey) ?? []) : [];

        if (isInlineCollection && expanded && members.length > 0 && layout === "grid") {
          return (
            <div
              key={seriesKey}
              className="col-span-full grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {renderProductCard(card.product, card, cardIndex)}
              {members.map((member) =>
                renderProductCard(member, card, cardIndex, {
                  iconOnlyMedia:
                    vaultSeriesUsesPerCountryCovers(
                      parseVaultSeriesGroupKey(seriesKey).subcategory
                    ) && !member.image_url?.trim(),
                  keySuffix: "-member",
                  seriesMember: true,
                })
              )}
            </div>
          );
        }

        return (
          <Fragment key={seriesKey ?? card.product.id}>
            <div className={itemClass}>
              {card.collectionHref && seriesKey && card.collectionLabel ? (
                renderSeriesCard(card, cardIndex)
              ) : (
                renderProductCard(card.product, card, cardIndex)
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
