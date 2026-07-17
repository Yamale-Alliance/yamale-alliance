"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Layers, Loader2, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { VaultCoverImage } from "@/components/marketplace/VaultCoverImage";
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
import {
  isFreeVaultItem,
  isPaidVaultSubcategory,
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
import {
  appendMarketplaceReturnToHref,
  marketplaceItemDetailHref,
  sanitizeMarketplaceReturnPath,
} from "@/lib/marketplace-public-url";
import { useClientSearchParams } from "@/lib/use-client-search-params";
import { displayVaultProductTitle } from "@/lib/marketplace-display";
import type { MarketplaceBrowsePayload } from "@/lib/marketplace-browse-data";
import styles from "@/components/marketplace/MarketplaceItemPage.module.css";

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
  const tItem = useTranslations("marketplace.itemPage");
  const { isSignedIn } = useAppUser();
  const searchParams = useClientSearchParams();
  const backHref =
    sanitizeMarketplaceReturnPath(searchParams.get("from")) ?? "/marketplace";
  const [items] = useState(initialPayload.items);
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
    () =>
      appendMarketplaceReturnToHref(
        vaultSeriesPageHref(seriesId, focusCountry),
        backHref === "/marketplace" ? null : backHref
      ),
    [seriesId, focusCountry, backHref]
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

  const separateTotalCents = useMemo(
    () => members.reduce((sum, m) => sum + Math.max(0, m.price_cents), 0),
    [members]
  );

  const closeBuyModal = () => {
    setBuyModalOpen(false);
    setBuyModalProduct(null);
    setBuyModalPackOffer(null);
    setCheckoutChoice("series");
    setBuyCheckoutLoading(false);
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
  const bundleDisplayCents = offer?.bundleCents ?? bundlePrice;
  const saveCents = Math.max(0, separateTotalCents - bundleDisplayCents);
  const savePct =
    separateTotalCents > 0 && saveCents > 0
      ? Math.round((saveCents / separateTotalCents) * 100)
      : 0;
  const allFree = members.length > 0 && members.every((member) => isFreeVaultItem(member.price_cents));
  const priceDisplay = allFree
    ? t("free")
    : showBundleCta
      ? formatUsd(bundlePrice)
      : offer?.fullyOwned
        ? t("owned")
        : formatUsd(separateTotalCents);

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

      <div className={styles.vdetail}>
        <div className={styles.vdetailInner}>
          <Link href={backHref} className={styles.vbacklink}>
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("landing.backToBrowse")}
          </Link>

          <div className={styles.vdCols}>
            <div>
              <div className={styles.fmtRow}>
                <span className={styles.fmtPill}>{t("collection")}</span>
                {allFree ? <span className={styles.fmtPill}>{t("free")}</span> : null}
                {offer?.fullyOwned ? <span className={styles.fmtPill}>{t("owned")}</span> : null}
              </div>

              <h1 className={styles.vdTitle}>{title}</h1>
              <p className={styles.vdByline}>
                {t("landing.resourceCount", { count: members.length })}
              </p>

              <div className={styles.includedProto}>
                <div className={styles.includedProtoCell}>
                  <b>{tItem("protoSeriesCount", { count: members.length })}</b>
                  {tItem("protoDownloadHint")}
                </div>
                <div className={styles.includedProtoCell}>
                  <b>{tItem("protoKeepTitle")}</b>
                  {tItem("protoKeepHint")}
                </div>
                <div className={styles.includedProtoCell}>
                  <b>{tItem("protoDraftedTitle")}</b>
                  {tItem("protoDraftedHint")}
                </div>
                <div className={styles.includedProtoCell}>
                  <b>{t("landing.oneTimePurchase")}</b>
                  {tItem("checkoutOneTime")}
                </div>
              </div>

              {blurb ? (
                <>
                  <h2 className={styles.vdSectionTitle}>{tItem("aboutResource")}</h2>
                  <p className={styles.vdDesc}>{blurb}</p>
                </>
              ) : null}

              <h2 className={styles.vdSectionTitle}>{t("landing.seriesItemsTitle")}</h2>
              <p className="mb-3 text-sm text-muted-foreground">{t("landing.seriesItemsHint")}</p>

              {members.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-8 py-12 text-center">
                  <p className="text-muted-foreground">{t("emptyHint")}</p>
                </div>
              ) : (
                <>
                  <div className={styles.seriesList}>
                    {members.map((product) => {
                      const free = isFreeVaultItem(product.price_cents);
                      return (
                        <Link
                          key={product.id}
                          href={marketplaceItemDetailHref(product, {
                            returnTo: seriesReturnPath,
                          })}
                          className={styles.seriesItem}
                        >
                          {product.image_url ? (
                            <VaultCoverImage
                              src={product.image_url}
                              className={styles.seriesItemThumb}
                              variant="thumb"
                            />
                          ) : (
                            <span className={styles.seriesItemThumbPlaceholder}>
                              <Layers className="h-4 w-4" aria-hidden />
                            </span>
                          )}
                          <span className={styles.seriesItemTitle}>
                            {displayVaultProductTitle(product.title)}
                          </span>
                          <span className={styles.seriesItemPrice}>
                            {free ? t("free") : formatUsd(product.price_cents)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  {showBundleCta && saveCents > 0 ? (
                    <p className={styles.seriesSave}>
                      {t("landing.seriesSaveHint", {
                        separate: formatUsd(separateTotalCents),
                        bundle: formatUsd(bundleDisplayCents),
                        save: formatUsd(saveCents),
                        pct: savePct,
                      })}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className={styles.buyCol}>
              <div className={styles.buyCover}>
                {coverUrl ? (
                  <VaultCoverImage src={coverUrl} className={styles.buyCoverImg} priority />
                ) : (
                  <div className={styles.buyCoverPlaceholder}>
                    <Layers className="h-8 w-8" aria-hidden />
                  </div>
                )}
              </div>

              <section className={styles.checkoutSection} aria-label={tItem("checkoutSectionLabel")}>
                <div className={styles.checkoutHeader}>
                  <div>
                    <p className={styles.checkoutEyebrow}>{tItem("checkoutEyebrow")}</p>
                    <p
                      className={`${styles.checkoutPrice} ${allFree || offer?.fullyOwned ? styles.checkoutPriceFree : ""}`}
                    >
                      {priceDisplay}
                    </p>
                  </div>
                  <p className={styles.checkoutHint}>
                    {offer?.fullyOwned
                      ? t("owned")
                      : allFree
                        ? tItem("getInstantAccess")
                        : tItem("checkoutOneTime")}
                  </p>
                </div>

                {showBundleCta ? (
                  <div className={styles.checkoutActions}>
                    <button
                      type="button"
                      onClick={openBuySeries}
                      disabled={buyCheckoutLoading}
                      className={styles.purchaseBtnPrimary}
                    >
                      {buyCheckoutLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          {offer!.ownedCount > 0
                            ? t("buyRemaining", { price: formatUsd(bundlePrice) })
                            : t("buyFullSeries", { price: formatUsd(bundlePrice) })}
                        </>
                      )}
                    </button>
                  </div>
                ) : null}

                {!allFree && showBundleCta ? (
                  <>
                    <p className={styles.secureNote}>{t("cartPage.secureCheckout")}</p>
                    <div className={styles.payMethods}>
                      <span className={styles.payMethodChip}>{t("landing.payMethodCard")}</span>
                      <span className={styles.payMethodChip}>{t("landing.payMethodMobileMoney")}</span>
                      <span className={styles.payMethodChip}>{t("landing.payMethodWallets")}</span>
                    </div>
                  </>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
