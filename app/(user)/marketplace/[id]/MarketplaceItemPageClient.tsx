"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useClientSearchParams } from "@/lib/use-client-search-params";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { VaultCoverImage } from "@/components/marketplace/VaultCoverImage";
import { coverObjectPosition, readItemCoverFocal } from "@/lib/marketplace-cover-framing";
import { BookOpen, GraduationCap, FileText, Loader2, ArrowLeft, ArrowRight, Eye, Star, ShoppingCart, Zap, X, Download, Globe, Layers, ShieldCheck, CheckCircle2, Scale, Sparkles } from "lucide-react";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { PawapayCountrySelect } from "@/components/checkout/PawapayCountrySelect";
import {
  PaymentMethodPicker,
  defaultCheckoutPaymentProvider,
  isLomiCheckoutAvailable,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import { DEFAULT_PAWAPAY_PAYMENT_COUNTRY } from "@/lib/pawapay-payment-countries";
import { FileViewer } from "@/components/marketplace/FileViewer";
import { MarketplaceFileAccessDialog } from "@/components/marketplace/MarketplaceFileAccessDialog";
import {
  defaultMarketplaceDownloadName,
  fetchMarketplaceFileUrl,
  saveMarketplaceFile,
  type MarketplaceFileAccessMeta,
} from "@/lib/marketplace-file-access";
import { VaultLanguageBadges } from "@/components/marketplace/VaultLanguageBadges";
import { resolveMarketplaceDisplayLanguageCodes } from "@/lib/marketplace-item-files";
import { MarketplaceLandingIframe } from "@/components/marketplace/MarketplaceLandingIframe";
import { useMarketplacePaymentReturn } from "@/components/marketplace/use-marketplace-payment-return";
import { notifyMarketplaceCartUpdated } from "@/lib/marketplace-cart-events";
import {
  marketplacePaymentReturnQuerySuffix,
  parseMarketplacePaymentReturn,
} from "@/lib/marketplace-payment-return";
import { shouldUseVaultPackagePage } from "@/lib/marketplace-zip-package";
import {
  marketplaceItemDetailHref,
  sanitizeMarketplaceReturnPath,
  seriesIdFromMarketplaceReturnPath,
} from "@/lib/marketplace-public-url";
import { displayVaultProductTitle, displayVaultPublisher } from "@/lib/marketplace-display";
import { isPaidVaultSubcategory, labelForVaultSubcategory, vaultSubcategoryMeta, type VaultSubcategoryId } from "@/lib/marketplace-vault-categories";
import { vaultSeriesPageHref } from "@/lib/marketplace-vault-series-display";
import type { MarketplaceSeriesOffer } from "@/lib/marketplace-series-offers";
import type { MarketplaceItemPackOffer } from "@/lib/marketplace-item-packs";
import {
  MarketplaceVaultCheckoutDialog,
  type MarketplaceVaultCheckoutChoice,
} from "@/components/marketplace/MarketplaceVaultCheckoutDialog";
import styles from "@/components/marketplace/MarketplaceItemPage.module.css";

const BRAND = {
  dark: "#221913",
  medium: "#603b1c",
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
  accent: "#e3ba65",
};

type Item = {
  id: string;
  slug?: string | null;
  type: string;
  title: string;
  author: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  cover_focal_x?: number | null;
  cover_focal_y?: number | null;
  published: boolean;
  purchased?: boolean;
  has_file?: boolean;
  file_name?: string | null;
  file_format?: string | null;
  language_codes?: string[];
  language_files?: MarketplaceFileAccessMeta[];
  video_url?: string | null;
  landing_page_html?: string | null;
  package_offers?: unknown;
  vault_subcategory?: string | null;
  created_at?: string;
};

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "book":
      return <BookOpen className="h-8 w-8" />;
    case "course":
      return <GraduationCap className="h-8 w-8" />;
    default:
      return <FileText className="h-8 w-8" />;
  }
}

function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // youtu.be/VIDEO_ID
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    // www.youtube.com or m.youtube.com
    if (u.hostname.includes("youtube.com")) {
      // Already an embed URL
      if (u.pathname.startsWith("/embed/")) {
        return u.toString();
      }
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    // fall through
  }
  return null;
}

function typeBadgeLabel(type: string, t: (key: string) => string): string {
  switch (type) {
    case "course":
      return t("typeBadges.course");
    case "guide":
      return t("typeBadges.guide");
    case "template":
      return t("typeBadges.template");
    case "book":
      return t("typeBadges.book");
    default:
      return type;
  }
}

function formatFileFormatLabel(fileFormat: string | null | undefined): string | null {
  const fmt = fileFormat?.trim().toLowerCase();
  if (!fmt) return null;
  return fmt.toUpperCase();
}

export default function MarketplaceItemPageClient({ slugOrId }: { slugOrId: string }) {
  const t = useTranslations("marketplace");
  const tItem = useTranslations("marketplace.itemPage");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useClientSearchParams();
  const { isLoaded, isSignedIn } = useAppUser();
  const id = slugOrId;
  const returnToParam = searchParams.get("from");
  const returnTo = sanitizeMarketplaceReturnPath(returnToParam);

  const backLink = useMemo(() => {
    if (returnTo) {
      const seriesId = seriesIdFromMarketplaceReturnPath(returnTo);
      if (seriesId) {
        const name = labelForVaultSubcategory(seriesId) ?? t("collection");
        return { href: returnTo, label: t("backToCollection", { name }) };
      }
      return { href: returnTo, label: t("landing.backToBrowse") };
    }
    return { href: "/marketplace", label: t("backToVault") };
  }, [returnTo, t]);

  const itemPublicPath = (item?: Item | null, packagePage = false) =>
    item
      ? marketplaceItemDetailHref(
          { id: item.id, slug: item.slug, packagePage },
          { returnTo }
        )
      : `/marketplace/${id}${packagePage ? "/package" : ""}`;

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<{ averageRating: number | null; totalReviews: number }>({
    averageRating: null,
    totalReviews: 0,
  });
  const [addingToCart, setAddingToCart] = useState(false);
  const [isInCart, setIsInCart] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [fileAccessOpen, setFileAccessOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [savingRating, setSavingRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [pawapayPaymentCountry, setPawapayPaymentCountry] = useState(DEFAULT_PAWAPAY_PAYMENT_COUNTRY);
  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>(
    defaultCheckoutPaymentProvider()
  );
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutChoice, setCheckoutChoice] = useState<MarketplaceVaultCheckoutChoice>("item");
  const [seriesOffer, setSeriesOffer] = useState<MarketplaceSeriesOffer | null>(null);
  const [packOffer, setPackOffer] = useState<MarketplaceItemPackOffer | null>(null);

  const backLinkWithItem = useMemo(() => {
    if (returnTo) return backLink;
    const seriesId = item?.vault_subcategory?.trim();
    if (seriesId) {
      const name = labelForVaultSubcategory(seriesId) ?? t("collection");
      return {
        href: vaultSeriesPageHref(seriesId),
        label: t("backToCollection", { name }),
      };
    }
    return backLink;
  }, [backLink, returnTo, item?.vault_subcategory, t]);

  const displayLanguageCodes = useMemo(
    () =>
      item
        ? resolveMarketplaceDisplayLanguageCodes(
            { title: item.title, slug: item.slug },
            item.language_codes ?? []
          )
        : [],
    [item]
  );

  const lomiAvailable = isLomiCheckoutAvailable();
  const lomiComingSoon = false;

  useEffect(() => {
    if (!lomiAvailable) {
      setPaymentProvider("pawapay");
      return;
    }
    setPaymentProvider((prev) => (prev === "lomi" ? "lomi" : "pawapay"));
  }, [lomiAvailable]);

  const refetchItem = useCallback(async () => {
    if (!id) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const r = await fetch(`${origin}/api/marketplace/${id}`, { credentials: "include" });
      const data = (await r.json()) as { item?: Item };
      if (data.item) setItem(data.item);
      else setError(tItem("itemNotFound"));
    } catch {
      setError(tItem("failedToLoad"));
    }
  }, [id]);

  const {
    params: paymentParams,
    paymentVerifyInProgress,
    showVerifiedPaymentSuccess,
    showPaymentNotCompleted,
  } = useMarketplacePaymentReturn({
    mode: "item",
    scopeId: id,
    clearParamsPathname: id ? itemPublicPath(item) : undefined,
    onConfirmed: refetchItem,
  });

  const checkoutCancelled = paymentParams.checkoutCancelled;

  const activeLanguage =
    selectedLanguage ?? item?.language_files?.[0]?.language_code ?? item?.language_codes?.[0] ?? null;

  const handleView = async () => {
    if (!item?.id || !item.has_file) return;
    setViewing(true);
    setError(null);
    try {
      const { url } = await fetchMarketplaceFileUrl(item.id, activeLanguage);
      setViewerUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : tItem("failedToLoad"));
    } finally {
      setViewing(false);
    }
  };

  const handleDownload = async () => {
    if (!item?.id || !item.has_file) return;
    setDownloading(true);
    setError(null);
    try {
      const { url, file_name: apiFileName, file_format: apiFileFormat } = await fetchMarketplaceFileUrl(
        item.id,
        activeLanguage
      );
      const activeMeta =
        item.language_files?.find((f) => f.language_code === activeLanguage) ?? item.language_files?.[0];
      const downloadName = defaultMarketplaceDownloadName(
        apiFileName ?? activeMeta?.file_name ?? item.file_name,
        apiFileFormat ?? activeMeta?.file_format ?? item.file_format
      );
      await saveMarketplaceFile(url, downloadName);
    } catch (e) {
      setError(e instanceof Error ? e.message : tItem("couldNotDownload"));
    } finally {
      setDownloading(false);
    }
  };

  const handleCloseViewer = () => {
    setViewerUrl(null);
    setViewing(false);
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    void refetchItem().finally(() => setLoading(false));
  }, [id, refetchItem, tItem]);

  useEffect(() => {
    if (loading || !item?.has_file) return;
    const wantsFileAccess = searchParams.get("file") === "access";
    if (!wantsFileAccess) return;
    const ownedOrFree = item.purchased || Number(item.price_cents) === 0;
    if (ownedOrFree) setFileAccessOpen(true);
  }, [loading, item, searchParams]);

  useEffect(() => {
    if (loading || !item || !id) return;
    if (!shouldUseVaultPackagePage(item)) return;
    const returnParams = parseMarketplacePaymentReturn(searchParams);
    const suffix = marketplacePaymentReturnQuerySuffix(returnParams);
    router.replace(`${itemPublicPath(item, true)}${suffix}`);
  }, [loading, item, id, router, searchParams]);

  // Fetch reviews
  useEffect(() => {
    if (!id) return;
    fetch(`/api/marketplace/${id}/reviews`)
      .then((r) => r.json())
      .then(
        (data: {
          averageRating?: number | null;
          totalReviews?: number;
          // we ignore individual reviews here – only summary is needed
        }) => {
          setReviews({
            averageRating: data.averageRating ?? null,
            totalReviews: data.totalReviews ?? 0,
          });
        }
      )
      .catch(() => {});
  }, [id]);

  // Check if item is in cart
  useEffect(() => {
    if (!isSignedIn || !id) {
      setIsInCart(false);
      return;
    }
    fetch("/api/cart", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { cart?: Array<{ marketplace_item_id: string }> }) => {
        const cart = data.cart ?? [];
        setIsInCart(cart.some((item) => item.marketplace_item_id === id));
      })
      .catch(() => setIsInCart(false));
  }, [isSignedIn, id]);

  useEffect(() => {
    if (!item?.id || item.price_cents <= 0 || item.purchased) {
      setPackOffer(null);
      return;
    }
    fetch(`/api/marketplace/${item.id}/pack-offer`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { offer?: MarketplaceItemPackOffer } | null) => {
        setPackOffer(data?.offer ?? null);
      })
      .catch(() => setPackOffer(null));
  }, [item?.id, item?.price_cents, item?.purchased]);

  useEffect(() => {
    if (!item?.vault_subcategory || !isPaidVaultSubcategory(item.vault_subcategory)) {
      setSeriesOffer(null);
      return;
    }
    const seriesId = item.vault_subcategory.trim() as VaultSubcategoryId;
    fetch(`/api/marketplace/series/${seriesId}/offer`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { offer?: MarketplaceSeriesOffer }) => {
        setSeriesOffer(data.offer ?? null);
      })
      .catch(() => setSeriesOffer(null));
  }, [item?.vault_subcategory, item?.purchased]);

  const handlePurchase = () => {
    if (!item || item.price_cents <= 0) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(itemPublicPath(item))}`);
      return;
    }
    setCheckoutChoice("item");
    setCheckoutOpen(true);
  };

  const submitCheckout = async () => {
    if (!item) return;
    setPurchasing(true);
    setError(null);
    try {
      const useSeries =
        checkoutChoice === "series" &&
        item.vault_subcategory &&
        seriesOffer &&
        !seriesOffer.fullyOwned;
      const usePack = checkoutChoice === "pack" && packOffer?.packEligible;
      const checkoutUrl = useSeries
        ? "/api/payments/marketplace-series-checkout"
        : usePack
          ? "/api/payments/marketplace-pack-checkout"
          : "/api/payments/marketplace-checkout";
      const res = await fetch(checkoutUrl, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(useSeries
              ? {
                  seriesId: item.vault_subcategory,
                  success_path: "/marketplace",
                }
              : usePack
                ? {
                    anchorItemId: packOffer!.anchorItemId,
                    success_path: itemPublicPath(item),
                  }
                : { itemId: item.id }),
            provider: paymentProvider,
            ...(paymentProvider === "pawapay" ? { paymentCountry: pawapayPaymentCountry } : {}),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("checkoutFailed"));
        setPurchasing(false);
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError(tItem("failedToLoad"));
    }
    setPurchasing(false);
  };

  const handleAddToCart = async () => {
    if (!item || item.price_cents <= 0 || item.purchased) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(itemPublicPath(item))}`);
      return;
    }
    setAddingToCart(true);
    setError(null);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ marketplace_item_id: item.id, quantity: 1 }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t("failedAddToCart"));
      } else {
        setIsInCart(true);
        notifyMarketplaceCartUpdated();
      }
    } catch {
      setError(tItem("failedToLoad"));
    } finally {
      setAddingToCart(false);
    }
  };

  const handleRemoveFromCart = async () => {
    if (!item || !isSignedIn) return;
    setAddingToCart(true);
    setError(null);
    try {
      const res = await fetch(`/api/cart?item_id=${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t("failedRemoveFromCart"));
      } else {
        setIsInCart(false);
        notifyMarketplaceCartUpdated();
      }
    } catch {
      setError(tItem("failedToLoad"));
    } finally {
      setAddingToCart(false);
    }
  };

  const handleGetFree = async () => {
    if (!item || item.price_cents > 0) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(itemPublicPath(item))}`);
      return;
    }
    setPurchasing(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/claim", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tItem("failedToClaim"));
        setPurchasing(false);
        return;
      }
      setItem((prev) => (prev ? { ...prev, purchased: true } : null));
    } catch {
      setError(tItem("failedToLoad"));
    }
    setPurchasing(false);
  };

  const handleSetRating = async (value: number) => {
    if (!item) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(itemPublicPath(item))}`);
      return;
    }
    if (!owned) {
      // Only allow users who own the item to rate
      return;
    }
    setSavingRating(true);
    setRatingError(null);
    setMyRating(value);
    try {
      const res = await fetch(`/api/marketplace/${id}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRatingError(data.error || tItem("failedToSaveRating"));
        return;
      }
      // Refresh summary after saving
      fetch(`/api/marketplace/${id}/reviews`)
        .then((r) => r.json())
        .then(
          (summary: { averageRating?: number | null; totalReviews?: number }) => {
            setReviews({
              averageRating: summary.averageRating ?? null,
              totalReviews: summary.totalReviews ?? 0,
            });
          }
        )
        .catch(() => {});
    } catch {
      setRatingError(tItem("failedToSaveRating"));
    } finally {
      setSavingRating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !item) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-muted-foreground">{error}</p>
        <Link href={backLinkWithItem.href} className="mt-4 inline-block text-primary hover:underline">
          ← {backLinkWithItem.label}
        </Link>
      </div>
    );
  }

  if (!item) return null;

  const owned = item.purchased;
  const free = Number(item.price_cents) === 0 || item.price_cents == 0;
  const priceDisplay = free ? t("free") : `$${(item.price_cents / 100).toFixed(2)}`;

  const landingHtml = item.landing_page_html?.trim();
  const seriesId = item.vault_subcategory?.trim() ?? null;
  const seriesName = seriesId ? labelForVaultSubcategory(seriesId) : null;
  const seriesMeta = seriesId ? vaultSubcategoryMeta(seriesId) : null;
  const seriesBlurb = seriesMeta?.blurb ?? seriesMeta?.description ?? null;
  const typeLabel = typeBadgeLabel(item.type, t);
  const formatLabel = formatFileFormatLabel(item.file_format);
  const languageCount = displayLanguageCodes.length;
  const coverFocalPosition = coverObjectPosition(readItemCoverFocal(item));
  const addedDate =
    item.created_at && !Number.isNaN(Date.parse(item.created_at))
      ? new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(
          new Date(item.created_at)
        )
      : null;

  if (shouldUseVaultPackagePage(item)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="sr-only">{tItem("openingPackage")}</span>
      </div>
    );
  }

  const whatsIncludedSection = (
    <div className={styles.heroIncluded}>
      <h2 className={styles.heroSectionTitle}>{tItem("whatsIncluded")}</h2>
      <div className={styles.includedGrid}>
        {item.has_file ? (
          <div className={styles.includedCard}>
            <div className={styles.includedIconWrap}>
              <Download className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className={styles.includedLabel}>{tItem("includedDownload")}</p>
              <p className={styles.includedDesc}>{tItem("includedDownloadDesc")}</p>
            </div>
          </div>
        ) : null}
        {languageCount > 0 ? (
          <div className={styles.includedCard}>
            <div className={styles.includedIconWrap}>
              <Globe className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className={styles.includedLabel}>{tItem("includedLanguages")}</p>
              <p className={styles.includedDesc}>
                <VaultLanguageBadges languageCodes={displayLanguageCodes} variant="card" />
              </p>
            </div>
          </div>
        ) : null}
        {formatLabel ? (
          <div className={styles.includedCard}>
            <div className={styles.includedIconWrap}>
              <FileText className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className={styles.includedLabel}>{tItem("includedFormat")}</p>
              <p className={styles.includedDesc}>{formatLabel}</p>
            </div>
          </div>
        ) : null}
        {addedDate ? (
          <div className={styles.includedCard}>
            <div className={styles.includedIconWrap}>
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className={styles.includedLabel}>{tItem("includedUpdated")}</p>
              <p className={styles.includedDesc}>{addedDate}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const purchasePanel = (
    <section className={styles.checkoutSection} aria-label={tItem("checkoutSectionLabel")}>
      <div className={styles.checkoutHeader}>
        <div>
          <p className={styles.checkoutEyebrow}>{tItem("checkoutEyebrow")}</p>
          <p className={`${styles.checkoutPrice} ${free ? styles.checkoutPriceFree : ""}`}>{priceDisplay}</p>
        </div>
        <p className={styles.checkoutHint}>
          {owned
            ? tItem("youOwnItem")
            : free
              ? tItem("getInstantAccess")
              : tItem("checkoutOneTime")}
        </p>
      </div>

      {!owned ? (
        <>
          {!free && lomiAvailable ? (
            <div className={styles.checkoutPayment}>
              <PaymentMethodPicker
                value={paymentProvider}
                onChange={setPaymentProvider}
                lomiAvailable={lomiAvailable}
                lomiComingSoon={lomiComingSoon}
                variant="segmented"
              />
            </div>
          ) : null}
          {!free && paymentProvider === "pawapay" ? (
            <div className={styles.checkoutCountry}>
              <PawapayCountrySelect
                label={t("cartPage.mobileMoneyCountry")}
                value={pawapayPaymentCountry}
                onChange={setPawapayPaymentCountry}
              />
            </div>
          ) : null}
          <div className={styles.checkoutActions}>
            {free ? (
              <button
                type="button"
                onClick={handleGetFree}
                disabled={purchasing}
                className={styles.purchaseBtnPrimary}
                style={{ background: `linear-gradient(to right, ${BRAND.gradientStart}, ${BRAND.gradientEnd})` }}
              >
                {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : t("getForFree")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className={styles.purchaseBtnPrimary}
                  style={{ background: `linear-gradient(to right, ${BRAND.gradientStart}, ${BRAND.gradientEnd})` }}
                >
                  {purchasing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      {t("buyNow")}
                    </>
                  )}
                </button>
                {isInCart ? (
                  <button
                    type="button"
                    onClick={handleRemoveFromCart}
                    disabled={addingToCart}
                    className={styles.purchaseBtnRemove}
                  >
                    {addingToCart ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X className="h-4 w-4" />
                        {t("removeFromCart")}
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                    className={styles.purchaseBtnSecondary}
                  >
                    {addingToCart ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4" />
                        {t("addToCart")}
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
          {!free ? (
            <p className={styles.secureNote}>
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("cartPage.secureCheckout")}
            </p>
          ) : null}
          {seriesOffer && !seriesOffer.fullyOwned && seriesName ? (
            <p className={styles.bundleUpsell}>
              <strong>{tItem("seriesBundleTitle", { name: seriesName })}</strong>
              <br />
              {tItem("seriesBundleHint", {
                price: `$${((seriesOffer.bundleCents ?? seriesOffer.chargeCents) / 100).toFixed(2)}`,
                count: seriesOffer.itemCount,
              })}
            </p>
          ) : null}
        </>
      ) : null}

      {(owned || free) && item.has_file ? (
        <div className={styles.accessSection}>
          <button
            type="button"
            onClick={() => setFileAccessOpen(true)}
            disabled={viewing || downloading}
            className={styles.purchaseBtnPrimary}
            style={{ background: `linear-gradient(to right, ${BRAND.gradientStart}, ${BRAND.gradientEnd})` }}
          >
            {viewing || downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {tItem("viewAndDownload")}
          </button>
        </div>
      ) : null}
      {(owned || free) && !item.has_file ? (
        <p className={`${styles.checkoutHint} mt-4`}>{tItem("noFileAttached")}</p>
      ) : null}
    </section>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <MarketplaceVaultCheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        product={item ? { id: item.id, title: item.title, price_cents: item.price_cents } : null}
        seriesOffer={seriesOffer}
        packOffer={packOffer}
        choice={checkoutChoice}
        onChoiceChange={setCheckoutChoice}
        paymentProvider={paymentProvider}
        onPaymentProviderChange={setPaymentProvider}
        pawapayPaymentCountry={pawapayPaymentCountry}
        onPawapayPaymentCountryChange={setPawapayPaymentCountry}
        lomiAvailable={lomiAvailable}
        lomiComingSoon={lomiComingSoon}
        loading={purchasing}
        onCheckout={() => void submitCheckout()}
      />
      {landingHtml ? (
        <div className="sticky top-0 z-20 border-b border-border bg-background/90 px-4 py-2.5 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
          <div className="mx-auto flex max-w-7xl items-center gap-3 sm:gap-4">
            <Link
              href={backLinkWithItem.href}
              className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />{" "}
              <span className="hidden sm:inline">{backLinkWithItem.label}</span>
              <span className="sm:hidden">{t("vaultShort")}</span>
            </Link>
            <span className="min-w-0 truncate font-sans text-sm text-muted-foreground" title={item.title}>
              {displayVaultProductTitle(item.title)}
            </span>
          </div>
        </div>
      ) : (
        <section className={styles.hero}>
          <div className={styles.heroBaseGradient} aria-hidden />
          {item.image_url ? (
            <div className={styles.heroBgCover} aria-hidden>
              <VaultCoverImage
                src={item.image_url}
                className={styles.heroBgCoverImage}
                objectPosition={coverFocalPosition}
                priority
              />
            </div>
          ) : null}
          <div className={styles.heroScrim} aria-hidden />
          <div className={styles.heroInner}>
            <Link href={backLinkWithItem.href} className={styles.backLink}>
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              {backLinkWithItem.label}
            </Link>
            <div className={styles.heroLayout}>
              <div className={styles.heroMain}>
                <div className={styles.badgeRow}>
                  <span className={styles.typeBadge}>{typeLabel}</span>
                  {owned ? (
                    <span className={styles.ownedBadge}>
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                      {t("owned")}
                    </span>
                  ) : free ? (
                    <span className={styles.typeBadge}>{t("free")}</span>
                  ) : null}
                </div>
                <h1 className={`vault-product-title ${styles.heroTitle}`} title={item.title}>
                  {displayVaultProductTitle(item.title)}
                </h1>
                {item.author ? (
                  <p className={styles.heroAuthor}>
                    {tItem("byAuthor", { author: displayVaultPublisher(item.author) })}
                  </p>
                ) : null}
                {reviews.totalReviews > 0 && reviews.averageRating !== null ? (
                  <div className={styles.ratingRow}>
                    <Star className="h-4 w-4 text-yellow-500 fill-current" aria-hidden />
                    <span className="text-sm font-semibold">{reviews.averageRating.toFixed(1)}</span>
                    <span className="text-sm text-white/65">
                      ({tItem("reviews", { count: reviews.totalReviews })})
                    </span>
                  </div>
                ) : null}
                {seriesId && seriesName ? (
                  <Link href={vaultSeriesPageHref(seriesId)} className={styles.seriesLink}>
                    <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {tItem("partOfCollection", { name: seriesName })}
                  </Link>
                ) : null}
                {whatsIncludedSection}
              </div>
              <div className={styles.heroAside}>
                <div
                  className={styles.heroCoverCard}
                  style={
                    item.image_url
                      ? undefined
                      : { background: `linear-gradient(135deg, ${BRAND.gradientStart}, ${BRAND.gradientEnd})` }
                  }
                >
                  {item.image_url ? (
                    <VaultCoverImage
                      src={item.image_url}
                      className={styles.heroCoverCardImage}
                      objectPosition={coverFocalPosition}
                      priority
                    />
                  ) : (
                    <div className={styles.heroCoverPlaceholder}>
                      <TypeIcon type={item.type} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {landingHtml ? <MarketplaceLandingIframe html={landingHtml} title={item.title} /> : null}

      {landingHtml ? (
        <div className="mx-auto max-w-3xl px-4 py-8">
          {(owned || free) && item.has_file ? (
            <section className={styles.purchaseCard}>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFileAccessOpen(true)}
                  disabled={viewing || downloading}
                  className={`${styles.purchaseBtnPrimary} max-w-xs`}
                  style={{ background: `linear-gradient(to right, ${BRAND.gradientStart}, ${BRAND.gradientEnd})` }}
                >
                  {viewing || downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  {tItem("viewAndDownload")}
                </button>
                {languageCount > 0 ? (
                  <VaultLanguageBadges languageCodes={displayLanguageCodes} variant="card" />
                ) : null}
              </div>
            </section>
          ) : null}
          {(owned || free) && !item.has_file ? (
            <p className="text-sm text-muted-foreground">{tItem("noFileAttached")}</p>
          ) : null}
        </div>
      ) : (
        <section className={styles.lowerBand}>
          <div className={styles.lowerInner}>
            {paymentVerifyInProgress ? (
              <div className={`${styles.alert} border border-border bg-muted text-foreground`}>
                {tCommon("confirmingPayment")}
              </div>
            ) : null}
            {showVerifiedPaymentSuccess ? (
              <div className={`${styles.alert} border border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300`}>
                {tItem("paymentSuccessItem")}
              </div>
            ) : null}
            {showPaymentNotCompleted && !showVerifiedPaymentSuccess ? (
              <div className={`${styles.alert} border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200`}>
                {tItem("paymentNotCompleted")}
              </div>
            ) : null}
            {checkoutCancelled && !showVerifiedPaymentSuccess && !showPaymentNotCompleted ? (
              <div className={`${styles.alert} border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200`}>
                {tItem("checkoutCancelled")}
              </div>
            ) : null}

            {seriesId && seriesName ? (
              <Link href={vaultSeriesPageHref(seriesId)} className={styles.exploreCard}>
                <div className={styles.exploreIconWrap}>
                  <Layers className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={styles.exploreEyebrow}>{t("collection")}</p>
                  <h2 className={styles.exploreTitle}>{tItem("exploreCollectionTitle", { name: seriesName })}</h2>
                  <p className={styles.exploreDesc}>
                    {seriesBlurb ?? tItem("exploreCollectionHint")}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-[#e8b84b]" aria-hidden />
              </Link>
            ) : null}

            <section className={styles.contentSection}>
              <h2 className={styles.lowerSectionTitle}>{tItem("aboutResource")}</h2>
              <div className={styles.lowerSectionBody}>
                {item.description?.trim() || t("cardDescriptionFallback")}
              </div>
            </section>

            <div className={styles.valueGrid}>
              <div className={styles.valueCard}>
                <Scale className="h-5 w-5 text-[#e8b84b]" aria-hidden />
                <p className={styles.valueLabel}>{tItem("valueExpertTitle")}</p>
                <p className={styles.valueDesc}>{tItem("valueExpertDesc")}</p>
              </div>
              <div className={styles.valueCard}>
                <Globe className="h-5 w-5 text-[#e8b84b]" aria-hidden />
                <p className={styles.valueLabel}>{tItem("valueLanguagesTitle")}</p>
                <p className={styles.valueDesc}>{tItem("valueLanguagesDesc")}</p>
              </div>
              <div className={styles.valueCard}>
                <Sparkles className="h-5 w-5 text-[#e8b84b]" aria-hidden />
                <p className={styles.valueLabel}>{tItem("valueAccessTitle")}</p>
                <p className={styles.valueDesc}>{tItem("valueAccessDesc")}</p>
              </div>
            </div>

            {purchasePanel}

            {getYouTubeEmbedUrl(item.video_url ?? null) && (free || owned) ? (
              <section className={styles.contentSection}>
                <h2 className={styles.lowerSectionTitle}>{tItem("productVideo")}</h2>
                <div className="overflow-hidden rounded-xl border border-border bg-black">
                  <div className="relative w-full pt-[56.25%]">
                    <iframe
                      src={getYouTubeEmbedUrl(item.video_url ?? null) ?? ""}
                      title={tItem("productVideo")}
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              </section>
            ) : null}

            {owned ? (
              <section className={styles.contentSection}>
                <h2 className={styles.lowerSectionTitle}>{tItem("rateProduct")}</h2>
                <p className="mb-3 text-sm text-muted-foreground">{tItem("rateProductHint")}</p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const active = (hoverRating ?? myRating ?? 0) >= value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onMouseEnter={() => setHoverRating(value)}
                        onMouseLeave={() => setHoverRating(null)}
                        onClick={() => handleSetRating(value)}
                        disabled={savingRating}
                        className="p-0.5 text-yellow-500 disabled:opacity-50"
                        aria-label={tItem("rateStars", { count: value })}
                      >
                        <Star className={`h-6 w-6 ${active ? "fill-current" : "stroke-current"}`} />
                      </button>
                    );
                  })}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {myRating ? tItem("youRated", { rating: myRating }) : tItem("clickToRate")}
                  </span>
                </div>
                {ratingError ? (
                  <p className="mt-1 text-xs text-destructive">{ratingError}</p>
                ) : null}
              </section>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </section>
      )}

      {item ? (
        <MarketplaceFileAccessDialog
          open={fileAccessOpen}
          onOpenChange={setFileAccessOpen}
          fileName={item.file_name}
          languageFiles={item.language_files}
          selectedLanguage={activeLanguage}
          onLanguageChange={setSelectedLanguage}
          busy={viewing || downloading}
          onPreview={() => void handleView()}
          onDownload={() => void handleDownload()}
        />
      ) : null}

      {viewerUrl && item && !shouldUseVaultPackagePage(item) ? (
        <FileViewer
          fileUrl={viewerUrl}
          fileName={item.file_name ?? null}
          fileFormat={item.file_format ?? null}
          onClose={handleCloseViewer}
          onDownload={() => void handleDownload()}
          downloading={downloading}
        />
      ) : null}
    </div>
  );
}
