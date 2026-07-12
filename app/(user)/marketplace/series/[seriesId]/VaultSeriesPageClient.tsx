"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { VaultCoverImage } from "@/components/marketplace/VaultCoverImage";
import { MarketplaceProductCard } from "@/components/marketplace/MarketplaceProductCard";
import type { MarketplaceProductCardProduct } from "@/components/marketplace/MarketplaceProductCard";
import {
  MarketplaceVaultCheckoutDialog,
  type MarketplaceVaultCheckoutChoice,
} from "@/components/marketplace/MarketplaceVaultCheckoutDialog";
import {
  defaultCheckoutPaymentProvider,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import { computeSeriesOfferFromBrowseItems } from "@/lib/marketplace-series-offers";
import type { MarketplaceItemPackOffer } from "@/lib/marketplace-item-packs";
import { notifyMarketplaceCartUpdated } from "@/lib/marketplace-cart-events";
import { useMarketplaceCart } from "@/lib/use-marketplace-cart";
import {
  isFreeVaultItem,
  isPaidVaultSubcategory,
  labelForVaultSubcategory,
  setVaultSeriesRegistry,
  vaultSubcategoryMeta,
  type VaultSubcategoryId,
} from "@/lib/marketplace-vault-categories";
import {
  filterSeriesMembers,
  resolveSeriesCollectionLabel,
  vaultSeriesCoverFromList,
  vaultSeriesPageHref,
  vaultSeriesRecordFromList,
} from "@/lib/marketplace-vault-series-display";
import { sortVaultProducts } from "@/lib/marketplace-vault-sort";
import type { MarketplaceBrowseItem, MarketplaceBrowsePayload } from "@/lib/marketplace-browse-data";

type VaultSeriesPageClientProps = {
  seriesId: string;
  focusCountry: string | null;
  initialPayload: MarketplaceBrowsePayload;
};

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function VaultSeriesPageClient({
  seriesId,
  focusCountry,
  initialPayload,
}: VaultSeriesPageClientProps) {
  const t = useTranslations("marketplace");
  const { isSignedIn } = useAppUser();
  const [items] = useState(initialPayload.items);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const { itemIds: cartItemIds, refresh: refreshCart } = useMarketplaceCart(!!isSignedIn);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [buyModalProduct, setBuyModalProduct] = useState<MarketplaceProductCardProduct | null>(null);
  const [buyModalPackOffer, setBuyModalPackOffer] = useState<MarketplaceItemPackOffer | null>(null);
  const [checkoutChoice, setCheckoutChoice] = useState<MarketplaceVaultCheckoutChoice>("series");
  const [buyCheckoutLoading, setBuyCheckoutLoading] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>(
    defaultCheckoutPaymentProvider()
  );

  useLayoutEffect(() => {
    if (initialPayload.vaultSeries.length > 0) {
      setVaultSeriesRegistry(initialPayload.vaultSeries);
    }
  }, [initialPayload.vaultSeries]);

  const vaultSeries = initialPayload.vaultSeries;

  const members = useMemo(
    () => sortVaultProducts(filterSeriesMembers(items, seriesId, focusCountry), "recent"),
    [items, seriesId, focusCountry]
  );

  const title = useMemo(
    () =>
      resolveSeriesCollectionLabel(
        seriesId,
        members,
        focusCountry,
        t("seriesLabel"),
        vaultSeries
      ),
    [seriesId, members, focusCountry, t, vaultSeries]
  );

  const seriesReturnPath = useMemo(
    () => vaultSeriesPageHref(seriesId, focusCountry),
    [seriesId, focusCountry]
  );

  const meta = vaultSeriesRecordFromList(seriesId, vaultSeries) ?? vaultSubcategoryMeta(seriesId);
  const blurb = meta?.blurb ?? meta?.description ?? members[0]?.description ?? null;
  const coverUrl =
    (focusCountry ? members.find((m) => m.image_url)?.image_url : null) ??
    vaultSeriesCoverFromList(seriesId, vaultSeries) ??
    (meta?.perCountryItemCovers
      ? null
      : (members.find((m) => m.image_url)?.image_url ?? null));

  const offer = useMemo(() => {
    if (!isPaidVaultSubcategory(seriesId) || members.length === 0) return null;
    return computeSeriesOfferFromBrowseItems(seriesId as VaultSubcategoryId, members);
  }, [seriesId, members]);

  const closeBuyModal = () => {
    setBuyModalOpen(false);
    setBuyModalProduct(null);
    setBuyModalPackOffer(null);
    setCheckoutChoice("series");
    setBuyCheckoutLoading(false);
  };

  const handleAddToCart = async (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    setAddingToCart(productId);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ marketplace_item_id: productId, quantity: 1 }),
      });
      if (res.ok) {
        await refreshCart();
        notifyMarketplaceCartUpdated();
      }
    } finally {
      setAddingToCart(null);
    }
  };

  const handleRemoveFromCart = async (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) return;
    setAddingToCart(productId);
    try {
      const res = await fetch(`/api/cart?item_id=${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        await refreshCart();
        notifyMarketplaceCartUpdated();
      }
    } finally {
      setAddingToCart(null);
    }
  };

  const openBuySeries = () => {
    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    setBuyModalProduct(null);
    setBuyModalPackOffer(null);
    setCheckoutChoice("series");
    setBuyModalOpen(true);
  };

  const openBuyProduct = (product: MarketplaceProductCardProduct, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    setBuyModalProduct(product);
    setBuyModalPackOffer(null);
    setCheckoutChoice("item");
    setBuyModalOpen(true);
    if (product.price_cents > 0) {
      fetch(`/api/marketplace/${product.id}/pack-offer`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { offer?: MarketplaceItemPackOffer } | null) => {
          setBuyModalPackOffer(data?.offer ?? null);
        })
        .catch(() => setBuyModalPackOffer(null));
    }
  };

  const submitBuyCheckout = async () => {
    const useSeries =
      checkoutChoice === "series" && offer && !offer.fullyOwned && !buyModalProduct;
    const usePack = checkoutChoice === "pack" && buyModalPackOffer?.packEligible;
    const useItem = checkoutChoice === "item" && buyModalProduct;
    if (!useSeries && !usePack && !useItem) return;

    setBuyCheckoutLoading(true);
    try {
      const checkoutUrl = useSeries
        ? "/api/payments/marketplace-series-checkout"
        : usePack
          ? "/api/payments/marketplace-pack-checkout"
          : "/api/payments/marketplace-checkout";
      const successPath = window.location.pathname + window.location.search;
      const res = await fetch(checkoutUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(useSeries
            ? { seriesId, success_path: successPath }
            : usePack
              ? {
                  anchorItemId: buyModalPackOffer!.anchorItemId,
                  success_path: successPath,
                }
              : { itemId: buyModalProduct!.id, success_path: successPath }),
          provider: "lomi",
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url as string;
      }
    } finally {
      setBuyCheckoutLoading(false);
    }
  };

  const showBundleCta = offer && !offer.fullyOwned;
  const bundlePrice =
    offer && offer.ownedCount > 0 ? offer.chargeCents : (offer?.bundleCents ?? offer?.chargeCents ?? 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      <MarketplaceVaultCheckoutDialog
        open={buyModalOpen}
        onOpenChange={(open) => {
          if (!open) closeBuyModal();
        }}
        product={buyModalProduct}
        seriesOffer={offer}
        packOffer={buyModalPackOffer}
        choice={checkoutChoice}
        onChoiceChange={setCheckoutChoice}
        paymentProvider={paymentProvider}
        onPaymentProviderChange={setPaymentProvider}
        lomiAvailable={false}
        lomiComingSoon={false}
        loading={buyCheckoutLoading}
        onCheckout={() => void submitBuyCheckout()}
      />

      <section className="relative overflow-hidden bg-[#0c1628] text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c1628] via-[#132038] to-[#1a2d4a]" />
        {coverUrl ? (
          <div className="absolute inset-0 opacity-35">
            <VaultCoverImage src={coverUrl} className="h-full w-full object-cover" priority />
          </div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1628] via-[#0c1628]/80 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/75 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("landing.backToBrowse")}
          </Link>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/85">
                <Layers className="h-3.5 w-3.5" />
                {t("collection")}
              </p>
              <h1 className="heading mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                {title}
              </h1>
              {blurb ? (
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/78 sm:text-lg">
                  {blurb}
                </p>
              ) : null}
              <p className="mt-4 text-sm font-medium text-white/65">
                {t("landing.resourceCount", { count: members.length })}
              </p>
            </div>

            {coverUrl ? (
              <div className="hidden overflow-hidden rounded-2xl border border-white/15 shadow-2xl lg:block">
                <VaultCoverImage src={coverUrl} className="aspect-[4/5] w-full object-cover" priority />
              </div>
            ) : null}
          </div>

          {showBundleCta ? (
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={openBuySeries}
                className="inline-flex items-center rounded-lg bg-[#C8922A] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#b07d22]"
              >
                {offer!.ownedCount > 0
                  ? t("buyRemaining", { price: formatUsd(bundlePrice) })
                  : t("buyFullSeries", { price: formatUsd(bundlePrice) })}
              </button>
            </div>
          ) : members.every((member) => isFreeVaultItem(member.price_cents)) ? (
            <p className="mt-8 inline-flex rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200">
              {t("free")}
            </p>
          ) : offer?.fullyOwned ? (
            <p className="mt-8 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white">
              {t("owned")}
            </p>
          ) : null}
        </div>
      </section>

      <section className="pb-16 pt-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">
            {t("landing.seriesItemsTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("landing.seriesItemsHint")}</p>

          {members.length === 0 ? (
            <div className="mt-10 rounded-xl border border-dashed border-border px-8 py-12 text-center">
              <p className="text-muted-foreground">{t("emptyHint")}</p>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {members.map((product, index) => (
                <MarketplaceProductCard
                  key={product.id}
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
                    isFreeVaultItem(product.price_cents)
                      ? labelForVaultSubcategory(product.vault_subcategory)
                      : null
                  }
                  isSignedIn={!!isSignedIn}
                  cartItemIds={cartItemIds}
                  addingToCart={addingToCart}
                  onAddToCart={handleAddToCart}
                  onRemoveFromCart={handleRemoveFromCart}
                  onBuy={openBuyProduct}
                  advisoryWorkspacePreview={initialPayload.advisoryWorkspacePreview}
                  coverPriority={index < 8}
                  returnTo={seriesReturnPath}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
