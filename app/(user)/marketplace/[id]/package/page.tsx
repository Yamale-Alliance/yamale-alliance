"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Download, Loader2 } from "lucide-react";
import { useMarketplacePaymentReturn } from "@/components/marketplace/use-marketplace-payment-return";
import type { CheckoutPaymentProvider } from "@/components/checkout/PaymentMethodPicker";
import { DEFAULT_PAWAPAY_PAYMENT_COUNTRY } from "@/lib/pawapay-payment-countries";
import { LawFirmDevelopmentZipLanding } from "@/components/marketplace/law-firm-development-package/LawFirmDevelopmentZipLanding";
import { GenericZipPackageLanding } from "@/components/marketplace/GenericZipPackageLanding";
import { MarketplaceLandingEmbed } from "@/components/marketplace/MarketplaceLandingEmbed";
import { ZipPackageContentsDialog } from "@/components/marketplace/ZipPackageContentsDialog";
import { ZipPackageCheckoutDialog } from "@/components/marketplace/ZipPackageCheckoutDialog";
import { VaultPackageSubheader } from "@/components/marketplace/VaultPackageSubheader";
import {
  hasLawFirmDevelopmentBuiltInLanding,
  isMarketplaceZip,
} from "@/lib/marketplace-zip-package";
import {
  packageOffersFromItemConfig,
  packageOffersFromLandingHtml,
  type PackageOfferTier,
  type PackageOffersResolved,
} from "@/lib/marketplace-package-offers";
import { useClientSearchParams } from "@/lib/use-client-search-params";

type Item = {
  id: string;
  type: string;
  title: string;
  author: string;
  description: string | null;
  price_cents: number;
  currency: string;
  purchased?: boolean;
  has_file?: boolean;
  file_name?: string | null;
  file_format?: string | null;
  landing_page_html?: string | null;
  package_offers?: Record<string, unknown> | null;
};

const DEFAULT_PURCHASE_SECTION_ID = "lfp-purchase";
/** Must not be `pricing` — landing HTML uses id="pricing" for its own section. */
const CUSTOM_LANDING_PURCHASE_SECTION_ID = "yamale-checkout";

export default function MarketplaceZipPackagePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { isLoaded, isSignedIn } = useUser();

  const lomiAvailable =
    process.env.NEXT_PUBLIC_LOMI_CHECKOUT_ENABLED === "1" ||
    Boolean(process.env.NEXT_PUBLIC_LOMI_PUBLISHABLE_KEY?.trim());
  const lomiComingSoon = false;
  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>("pawapay");
  const [pawapayPaymentCountry, setPawapayPaymentCountry] = useState(DEFAULT_PAWAPAY_PAYMENT_COUNTRY);

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [zipViewerOpen, setZipViewerOpen] = useState(false);
  const [packageOffers, setPackageOffers] = useState<PackageOffersResolved | null>(null);
  const [selectedTier, setSelectedTier] = useState<PackageOfferTier>("standalone");
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);

  const searchParams = useClientSearchParams();
  const bundlePaymentReturn = searchParams.get("bundle") === "1";

  const customLandingHtml = item?.landing_page_html?.trim() ?? "";
  const purchaseSectionId = customLandingHtml
    ? CUSTOM_LANDING_PURCHASE_SECTION_ID
    : DEFAULT_PURCHASE_SECTION_ID;

  const refetchItem = useCallback(async () => {
    if (!id) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const r = await fetch(`${origin}/api/marketplace/${id}`, { credentials: "include" });
      const data = (await r.json()) as { item?: Item };
      if (data.item) {
        setItem(data.item);
        if (data.item.purchased && data.item.has_file) {
          setZipViewerOpen(true);
        }
      }
    } catch {
      // ignore
    }
  }, [id]);

  const {
    params: paymentParams,
    paymentVerifyInProgress,
    showVerifiedPaymentSuccess,
    showPaymentNotCompleted,
  } = useMarketplacePaymentReturn({
    mode: bundlePaymentReturn ? "cart" : "item",
    scopeId: id,
    clearParamsPathname: id ? `/marketplace/${id}/package` : undefined,
    onConfirmed: refetchItem,
  });

  const checkoutCancelled = paymentParams.checkoutCancelled;

  useEffect(() => {
    if ((!lomiAvailable || lomiComingSoon) && paymentProvider === "lomi") {
      setPaymentProvider("pawapay");
    }
  }, [lomiAvailable, lomiComingSoon, paymentProvider]);

  useEffect(() => {
    if (!id) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setLoading(true);
    fetch(`${origin}/api/marketplace/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { item?: Item }) => {
        if (data.item) setItem(data.item);
        else setError("Item not found");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && item && !isMarketplaceZip(item)) {
      router.replace(`/marketplace/${id}`);
    }
  }, [loading, item, id, router]);

  useEffect(() => {
    if (!id || !customLandingHtml) {
      setPackageOffers(null);
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    fetch(`${origin}/api/marketplace/${id}/package-offers`, { credentials: "include" })
      .then(async (r) => {
        const data = (await r.json()) as { offers?: PackageOffersResolved | null; error?: string };
        if (r.ok && data.offers) {
          setPackageOffers(data.offers);
          return;
        }
        setPackageOffers(null);
      })
      .catch(() => setPackageOffers(null));
  }, [id, customLandingHtml]);

  useEffect(() => {
    if (!item?.package_offers || packageOffers) return;
    const local = packageOffersFromItemConfig(item.id, {
      id: item.id,
      title: item.title,
      price_cents: item.price_cents,
      currency: item.currency,
      published: true,
      package_offers: item.package_offers,
    });
    if (local) setPackageOffers(local);
  }, [item, packageOffers]);

  const effectiveOffers = useMemo(() => {
    if (packageOffers) return packageOffers;
    if (!item) return null;
    const row = {
      id: item.id,
      title: item.title,
      price_cents: item.price_cents,
      currency: item.currency,
      published: true,
      package_offers: item.package_offers,
    };
    return (
      packageOffersFromItemConfig(item.id, row) ??
      (customLandingHtml ? packageOffersFromLandingHtml(item.id, row, customLandingHtml) : null)
    );
  }, [packageOffers, item, customLandingHtml]);

  const openCheckoutDialog = useCallback(
    (tier: PackageOfferTier | null) => {
      if (!item || item.purchased) return;
      if (!isLoaded) return;
      if (!isSignedIn) {
        router.push(`/sign-in?redirect_url=${encodeURIComponent(`/marketplace/${id}/package`)}`);
        return;
      }
      const nextTier: PackageOfferTier =
        tier === "standalone" || tier === "bundle"
          ? tier
          : effectiveOffers
            ? "standalone"
            : "standalone";
      setSelectedTier(nextTier);
      setError(null);
      setCheckoutDialogOpen(true);
    },
    [item, isLoaded, isSignedIn, router, id, effectiveOffers]
  );

  const fetchDownloadUrl = async () => {
    if (!item?.id || !item.has_file) return null;
    const res = await fetch(`/api/marketplace/${item.id}/download`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not get file");
    return data.url as string;
  };

  const handleDownload = async () => {
    if (!item?.id || !item.has_file) return;
    setDownloading(true);
    setError(null);
    try {
      const url = await fetchDownloadUrl();
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = item.file_name ?? `download.${item.file_format ?? "zip"}`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download");
    } finally {
      setDownloading(false);
    }
  };

  const beginPaidDownload = () => {
    openCheckoutDialog(effectiveOffers ? "standalone" : null);
  };

  const handleOwnedDownload = async () => {
    await handleDownload();
  };

  const handlePackageCheckout = async () => {
    if (!item || item.purchased) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/marketplace/${id}/package`)}`);
      return;
    }

    const checkoutItemId = item.id;

    const hasDualPricing = Boolean(effectiveOffers);
    if (Number(item.price_cents) <= 0 && !hasDualPricing) return;

    setPurchasing(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/marketplace-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: checkoutItemId,
          tier: hasDualPricing ? selectedTier : "standalone",
          provider: paymentProvider,
          success_path:
            effectiveOffers && selectedTier === "bundle"
              ? `/marketplace/${id}/package?bundle=1`
              : `/marketplace/${id}/package`,
          ...(paymentProvider === "pawapay" ? { paymentCountry: pawapayPaymentCountry } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Checkout failed");
        setPurchasing(false);
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Something went wrong");
    }
    setPurchasing(false);
  };

  const handleGetFree = async () => {
    if (!item || item.price_cents > 0) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/marketplace/${id}/package`)}`);
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
        setError(data.error ?? "Failed to claim");
        setPurchasing(false);
        return;
      }
      setItem((prev) => (prev ? { ...prev, purchased: true } : null));
    } catch {
      setError("Something went wrong");
    }
    setPurchasing(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#221913]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C18C43]" />
      </div>
    );
  }

  if (error && !item) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-white">
        <p className="text-white/70">{error}</p>
        <Link href="/marketplace" className="mt-4 inline-block text-[#E3BA65] hover:underline">
          ← Back to The Yamale Vault
        </Link>
      </div>
    );
  }

  if (!item || !isMarketplaceZip(item)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#221913]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C18C43]" />
      </div>
    );
  }

  const owned = item.purchased;
  const free = Number(item.price_cents) === 0;
  const priceDisplay = free
    ? "Free"
    : effectiveOffers
      ? `$${(
          (selectedTier === "standalone"
            ? effectiveOffers.standalone.price_cents
            : effectiveOffers.bundle.total_cents) / 100
        ).toFixed(2)}`
      : `$${(item.price_cents / 100).toFixed(2)}`;

  const lawFirmLanding = !customLandingHtml && hasLawFirmDevelopmentBuiltInLanding(item);
  const usePlatformChrome = Boolean(customLandingHtml);

  return (
    <div className={usePlatformChrome ? "min-h-screen bg-background pb-24" : "min-h-screen bg-[#221913] pb-24"}>
      {id && (
        <ZipPackageContentsDialog itemId={id} open={zipViewerOpen} onOpenChange={setZipViewerOpen} />
      )}
      {!lawFirmLanding && (
        <VaultPackageSubheader
          title={item.title}
          variant={usePlatformChrome ? "platform" : "vault"}
        />
      )}

      {paymentVerifyInProgress && (
        <div
          className={
            lawFirmLanding
              ? "mx-auto max-w-3xl px-4 pt-[calc(5.5rem+0.75rem)] sm:pt-[calc(5.75rem+1rem)]"
              : "mx-auto max-w-3xl px-4 pt-6"
          }
        >
          <div className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm text-white/80">
            Confirming payment…
          </div>
        </div>
      )}
      {showVerifiedPaymentSuccess && (
        <div
          className={
            lawFirmLanding
              ? "mx-auto max-w-3xl px-4 pt-[calc(5.5rem+0.75rem)] sm:pt-[calc(5.75rem+1rem)]"
              : "mx-auto max-w-3xl px-4 pt-6"
          }
        >
          <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200">
            Payment successful. You now have access to this package.
          </div>
        </div>
      )}
      {showPaymentNotCompleted && !showVerifiedPaymentSuccess && (
        <div
          className={
            lawFirmLanding
              ? "mx-auto max-w-3xl px-4 pt-[calc(5.5rem+0.75rem)] sm:pt-[calc(5.75rem+1rem)]"
              : "mx-auto max-w-3xl px-4 pt-6"
          }
        >
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Payment was not completed. If you already paid, wait a moment and refresh the page, or contact support.
          </div>
        </div>
      )}
      {checkoutCancelled && !showVerifiedPaymentSuccess && !showPaymentNotCompleted && (
        <div
          className={
            lawFirmLanding
              ? "mx-auto max-w-3xl px-4 pt-[calc(5.5rem+0.75rem)] sm:pt-[calc(5.75rem+1rem)]"
              : "mx-auto max-w-3xl px-4 pt-6"
          }
        >
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Checkout was cancelled.
          </div>
        </div>
      )}

      {lawFirmLanding ? (
        <LawFirmDevelopmentZipLanding
          priceDisplay={priceDisplay}
          owned={!!owned}
          onBeginPaidDownload={beginPaidDownload}
          onOwnedDownload={handleOwnedDownload}
          onBrowseZipContents={owned && item.has_file ? () => setZipViewerOpen(true) : undefined}
        />
      ) : customLandingHtml ? (
        <MarketplaceLandingEmbed
          html={customLandingHtml}
          className="overflow-hidden border-0"
          onCheckoutClick={openCheckoutDialog}
        />
      ) : (
        <GenericZipPackageLanding
          title={item.title}
          description={item.description}
          priceDisplay={priceDisplay}
          onPurchaseClick={() => openCheckoutDialog(effectiveOffers ? "standalone" : null)}
        />
      )}

      {!owned && !free && (
        <ZipPackageCheckoutDialog
          open={checkoutDialogOpen}
          onOpenChange={setCheckoutDialogOpen}
          offers={effectiveOffers}
          singlePriceCents={item.price_cents}
          itemTitle={item.title}
          selectedTier={selectedTier}
          onSelectTier={setSelectedTier}
          paymentProvider={paymentProvider}
          onPaymentProviderChange={setPaymentProvider}
          pawapayPaymentCountry={pawapayPaymentCountry}
          onPawapayPaymentCountryChange={setPawapayPaymentCountry}
          lomiAvailable={lomiAvailable}
          lomiComingSoon={lomiComingSoon}
          onLomiComingSoonClick={() => {
            setError("Credit card payments are coming soon. For now, please use Mobile Money.");
          }}
          purchasing={purchasing}
          onCheckout={handlePackageCheckout}
          error={error}
        />
      )}

      {owned && item.has_file && (lawFirmLanding || customLandingHtml) && (
        <section className="mx-auto mt-8 max-w-3xl px-4 pb-8">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/15 bg-white/[0.06] p-4">
            <button
              type="button"
              onClick={() => setZipViewerOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10"
            >
              View package contents
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#C18C43] px-5 py-2.5 text-sm font-semibold text-[#221913] hover:bg-[#E3BA65] disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download ZIP
            </button>
            <Link href={`/marketplace/${id}`} className="text-sm text-[#E3BA65] hover:underline">
              Ratings & details
            </Link>
          </div>
        </section>
      )}

      {!customLandingHtml && !lawFirmLanding && (
        <section
          id={purchaseSectionId}
          className="mx-auto mt-8 max-w-3xl scroll-mt-[calc(72px+5.5rem)] px-4 sm:scroll-mt-[calc(88px+5.5rem)]"
        >
          <div className="rounded-xl border border-[rgba(193,140,67,0.25)] bg-white/[0.06] p-6 backdrop-blur-sm">
            {!owned && free ? (
              <button
                type="button"
                onClick={handleGetFree}
                disabled={purchasing}
                className="rounded-lg bg-[#C18C43] px-6 py-2.5 text-sm font-semibold text-[#221913] hover:bg-[#E3BA65] disabled:opacity-50"
              >
                {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get for free"}
              </button>
            ) : null}
            {!owned && !free ? (
              <button
                type="button"
                onClick={() => openCheckoutDialog(effectiveOffers ? "standalone" : null)}
                className="rounded-lg bg-[#C18C43] px-6 py-2.5 text-sm font-semibold text-[#221913] hover:bg-[#E3BA65]"
              >
                Purchase — {priceDisplay}
              </button>
            ) : null}
            {owned && item.has_file ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setZipViewerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10"
                >
                  View package contents
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#C18C43] px-5 py-2.5 text-sm font-semibold text-[#221913] hover:bg-[#E3BA65] disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download ZIP
                </button>
              </div>
            ) : null}
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </section>
      )}

    </div>
  );
}
