"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import {
  PaymentMethodPicker,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import { PawapayCountrySelect } from "@/components/checkout/PawapayCountrySelect";
import { DEFAULT_PAWAPAY_PAYMENT_COUNTRY } from "@/lib/pawapay-payment-countries";
import { LawFirmDevelopmentZipLanding } from "@/components/marketplace/law-firm-development-package/LawFirmDevelopmentZipLanding";
import { GenericZipPackageLanding } from "@/components/marketplace/GenericZipPackageLanding";
import { ZipPackageContentsDialog } from "@/components/marketplace/ZipPackageContentsDialog";
import {
  hasLawFirmDevelopmentBuiltInLanding,
  isMarketplaceZip,
} from "@/lib/marketplace-zip-package";

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
};

const PURCHASE_SECTION_ID = "lfp-purchase";

export default function MarketplaceZipPackagePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const { isLoaded, isSignedIn } = useUser();

  const lomiAvailable =
    process.env.NEXT_PUBLIC_LOMI_CHECKOUT_ENABLED === "1" ||
    Boolean(process.env.NEXT_PUBLIC_LOMI_PUBLISHABLE_KEY?.trim());
  const lomiComingSoon = true;
  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>("pawapay");
  const [pawapayPaymentCountry, setPawapayPaymentCountry] = useState(DEFAULT_PAWAPAY_PAYMENT_COUNTRY);

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [isInCart, setIsInCart] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [zipViewerOpen, setZipViewerOpen] = useState(false);

  const checkoutStatus = searchParams?.get("checkout");
  const confirmedPaymentSessionRef = useRef<string | null>(null);

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
    if (!isSignedIn || !id) {
      setIsInCart(false);
      return;
    }
    fetch("/api/cart", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { cart?: Array<{ marketplace_item_id: string }> }) => {
        const cart = data.cart ?? [];
        setIsInCart(cart.some((row) => row.marketplace_item_id === id));
      })
      .catch(() => setIsInCart(false));
  }, [isSignedIn, id]);

  useEffect(() => {
    if (!loading && item && !isMarketplaceZip(item)) {
      router.replace(`/marketplace/${id}`);
    }
  }, [loading, item, id, router]);

  useEffect(() => {
    const sessionId = searchParams?.get("session_id");
    if (!sessionId || !isSignedIn || !id || confirmedPaymentSessionRef.current === sessionId) return;
    confirmedPaymentSessionRef.current = sessionId;

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const run = async () => {
      try {
        await fetch("/api/cart/confirm-payment", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch {
        // webhook may still apply
      }
      if (typeof window !== "undefined" && window.history.replaceState) {
        const u = new URL(window.location.href);
        u.searchParams.delete("session_id");
        window.history.replaceState({}, "", u.toString());
      }
      try {
        const r = await fetch(`${origin}/api/marketplace/${id}`, { credentials: "include" });
        const data = await r.json();
        if (data.item) setItem(data.item);
      } catch {
        // ignore
      }
    };
    void run();
  }, [searchParams, isSignedIn, id]);

  const refetchItem = () => {
    if (!id) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    fetch(`${origin}/api/marketplace/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { item?: Item }) => {
        if (data.item) setItem(data.item);
      })
      .catch(() => {});
  };

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

  const ensureInCart = async (): Promise<boolean> => {
    if (!item || item.purchased) return false;
    if (isInCart) return true;
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ marketplace_item_id: item.id, quantity: 1 }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to add to cart");
      return false;
    }
    setIsInCart(true);
    return true;
  };

  const beginPaidDownload = async () => {
    if (!item || item.purchased || item.price_cents <= 0) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/marketplace/${id}/package`)}`);
      return;
    }
    setAddingToCart(true);
    setError(null);
    try {
      const ok = await ensureInCart();
      if (!ok) return;
    } catch {
      setError("Something went wrong");
    } finally {
      setAddingToCart(false);
    }
    document.getElementById(PURCHASE_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleOwnedDownload = async () => {
    await handleDownload();
  };

  const handlePackageCheckout = async () => {
    if (!item || item.purchased || item.price_cents <= 0) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/marketplace/${id}/package`)}`);
      return;
    }
    setPurchasing(true);
    setError(null);
    try {
      const ok = await ensureInCart();
      if (!ok) {
        setPurchasing(false);
        return;
      }
      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: paymentProvider,
          success_path: `/marketplace/${id}/package`,
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
  const priceDisplay = free ? "Free" : `$${(item.price_cents / 100).toFixed(2)}`;

  const lawFirmLanding = hasLawFirmDevelopmentBuiltInLanding(item);

  return (
    <div className="min-h-screen pb-24">
      {id && (
        <ZipPackageContentsDialog itemId={id} open={zipViewerOpen} onOpenChange={setZipViewerOpen} />
      )}
      {!lawFirmLanding && (
        <header className="sticky top-[72px] z-30 border-b border-[rgba(193,140,67,0.15)] bg-[#221913]/95 px-4 py-3 backdrop-blur-md sm:top-[88px]">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <Link
              href="/marketplace"
              className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Back to The Yamale Vault</span>
              <span className="sm:hidden">Vault</span>
            </Link>
            <span className="min-w-0 truncate text-sm text-white/50" title={item.title}>
              {item.title}
            </span>
          </div>
        </header>
      )}

      {checkoutStatus === "success" && (
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

      {lawFirmLanding ? (
        <LawFirmDevelopmentZipLanding
          priceDisplay={priceDisplay}
          owned={!!owned}
          onBeginPaidDownload={beginPaidDownload}
          onOwnedDownload={handleOwnedDownload}
          onBrowseZipContents={owned && item.has_file ? () => setZipViewerOpen(true) : undefined}
        />
      ) : (
        <GenericZipPackageLanding
          title={item.title}
          description={item.description}
          priceDisplay={priceDisplay}
          purchaseSectionId={PURCHASE_SECTION_ID}
        />
      )}

      <section
        id={PURCHASE_SECTION_ID}
        className="mx-auto mt-8 max-w-3xl scroll-mt-[calc(72px+5.5rem)] px-4 sm:scroll-mt-[calc(88px+5.5rem)]"
      >
        <div className="rounded-xl border border-[rgba(193,140,67,0.25)] bg-white/[0.06] p-6 backdrop-blur-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-2xl font-semibold text-white">{priceDisplay}</p>
              <p className="text-sm text-white/55">
                {owned ? "You own this package." : free ? "Claim free access." : "Choose mobile money or card, then continue to pay."}
              </p>
            </div>
            {!owned && (
              <div className="flex flex-wrap gap-2">
                {free ? (
                  <button
                    type="button"
                    onClick={handleGetFree}
                    disabled={purchasing}
                    className="rounded-lg bg-[#C18C43] px-6 py-2.5 text-sm font-semibold text-[#221913] hover:bg-[#E3BA65] disabled:opacity-50"
                  >
                    {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get for free"}
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {!owned && !free && (
            <div className="mt-6 space-y-4 border-t border-white/10 pt-6">
              <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-white [&_.text-muted-foreground]:text-white/65 [&_.text-foreground]:text-white">
                <PaymentMethodPicker
                  value={paymentProvider}
                  onChange={setPaymentProvider}
                  lomiAvailable={lomiAvailable}
                  lomiComingSoon={lomiComingSoon}
                  onLomiComingSoonClick={() => {
                    setError("Credit card payments are coming soon. For now, please use Mobile Money.");
                  }}
                />
                {paymentProvider === "pawapay" && (
                  <div className="mt-4">
                    <PawapayCountrySelect
                      label="Mobile money country"
                      value={pawapayPaymentCountry}
                      onChange={setPawapayPaymentCountry}
                      selectClassName="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#C8922A]/40"
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handlePackageCheckout}
                disabled={purchasing || addingToCart}
                className="w-full rounded-lg bg-[#C18C43] px-6 py-3 text-sm font-semibold text-[#221913] transition hover:bg-[#E3BA65] disabled:opacity-50 sm:w-auto"
              >
                {purchasing || addingToCart ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparing checkout…
                  </span>
                ) : (
                  "Proceed to checkout"
                )}
              </button>
              <p className="text-xs text-white/45">
                You will confirm payment on the provider screen. After payment you&apos;ll return here to download.
              </p>
            </div>
          )}

          {owned && item.has_file && !lawFirmLanding && (
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
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
          )}

          {owned && lawFirmLanding && item.has_file && (
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-6 text-sm text-white/55">
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
              <Link href={`/marketplace/${id}`} className="text-[#E3BA65] hover:underline">
                Ratings & details
              </Link>
            </div>
          )}

          {owned && lawFirmLanding && !item.has_file && (
            <div className="mt-6 border-t border-white/10 pt-6 text-sm text-white/55">
              <Link href={`/marketplace/${id}`} className="text-[#E3BA65] hover:underline">
                Ratings & details
              </Link>
            </div>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </section>
    </div>
  );
}
