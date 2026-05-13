"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, GraduationCap, FileText, Loader2, ArrowLeft, Eye, Star, ShoppingCart, Zap, X, Download } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { PawapayCountrySelect } from "@/components/checkout/PawapayCountrySelect";
import { DEFAULT_PAWAPAY_PAYMENT_COUNTRY } from "@/lib/pawapay-payment-countries";
import { FileViewer } from "@/components/marketplace/FileViewer";
import { MarketplaceLandingIframe } from "@/components/marketplace/MarketplaceLandingIframe";

const BRAND = {
  dark: "#221913",
  medium: "#603b1c",
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
  accent: "#e3ba65",
};

type Item = {
  id: string;
  type: string;
  title: string;
  author: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  published: boolean;
  purchased?: boolean;
  has_file?: boolean;
  file_name?: string | null;
  file_format?: string | null;
  video_url?: string | null;
  landing_page_html?: string | null;
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

export default function MarketplaceItemPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const id = params?.id as string;

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
  const [myRating, setMyRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [savingRating, setSavingRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [pawapayPaymentCountry, setPawapayPaymentCountry] = useState(DEFAULT_PAWAPAY_PAYMENT_COUNTRY);

  const checkoutStatus = searchParams?.get("checkout");
  const sessionId = searchParams?.get("session_id") ?? null;
  const confirmedSessionRef = useRef<string | null>(null);

  const fetchDownloadUrl = async () => {
    if (!item?.id || !item.has_file) return null;
    const res = await fetch(`/api/marketplace/${item.id}/download`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not get file");
    return data.url as string;
  };

  const handleView = async () => {
    if (!item?.id || !item.has_file) return;
    setViewing(true);
    setError(null);
    try {
      const url = await fetchDownloadUrl();
      if (url) setViewerUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setViewing(false);
    }
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
        a.download = item.file_name ?? `download.${item.file_format ?? "pdf"}`;
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

  const handleCloseViewer = () => {
    setViewerUrl(null);
    setViewing(false);
  };

  // On return from Stripe: confirm payment then refetch so "View/Download" appears
  useEffect(() => {
    if (!id) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    const run = async () => {
      if (checkoutStatus === "success" && sessionId && confirmedSessionRef.current !== sessionId) {
        confirmedSessionRef.current = sessionId;
        try {
          await fetch("/api/marketplace/confirm-payment", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
          });
        } catch {
          // ignore; webhook may still apply
        }
        // Clean URL so refresh doesn't re-trigger
        if (typeof window !== "undefined" && window.history.replaceState) {
          window.history.replaceState({}, "", `${window.location.pathname}?checkout=success`);
        }
      }

      setLoading(true);
      try {
        const r = await fetch(`${origin}/api/marketplace/${id}`, { credentials: "include" });
        const data = await r.json();
        if (data.item) setItem(data.item);
        else setError("Item not found");
      } catch {
        setError("Failed to load");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id, checkoutStatus, sessionId]);

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
    if (loading || !item || !id) return;
    const zip =
      item.file_format?.toLowerCase() === "zip" ||
      (item.file_name?.toLowerCase().endsWith(".zip") ?? false);
    if (zip) {
      router.replace(`/marketplace/${id}/package`);
    }
  }, [loading, item, id, router]);

  const handlePurchase = async () => {
    if (!item || item.price_cents <= 0) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/marketplace/${id}`)}`);
      return;
    }
    setPurchasing(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/marketplace-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, paymentCountry: pawapayPaymentCountry }),
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

  const handleAddToCart = async () => {
    if (!item || item.price_cents <= 0 || item.purchased) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/marketplace/${id}`)}`);
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
        setError(data.error ?? "Failed to add to cart");
      } else {
        setIsInCart(true);
      }
    } catch {
      setError("Something went wrong");
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
        setError(data.error ?? "Failed to remove from cart");
      } else {
        setIsInCart(false);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleGetFree = async () => {
    if (!item || item.price_cents > 0) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/marketplace/${id}`)}`);
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

  const handleSetRating = async (value: number) => {
    if (!item) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/marketplace/${id}`)}`);
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
        setRatingError(data.error || "Failed to save rating");
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
      setRatingError("Failed to save rating");
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
        <Link href="/marketplace" className="mt-4 inline-block text-primary hover:underline">
          ← Back to The Yamale Vault
        </Link>
      </div>
    );
  }

  if (!item) return null;

  const owned = item.purchased;
  const free = Number(item.price_cents) === 0 || item.price_cents == 0;
  const priceDisplay = free ? "Free" : `$${(item.price_cents / 100).toFixed(2)}`;

  const fileFmt = item.file_format?.toLowerCase() ?? "";
  const fileNameLower = item.file_name?.toLowerCase() ?? "";
  const isZip = fileFmt === "zip" || fileNameLower.endsWith(".zip");

  const landingHtml = item.landing_page_html?.trim();

  if (isZip) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {landingHtml ? (
        <div className="sticky top-0 z-20 border-b border-border bg-background/90 px-4 py-2.5 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
          <div className="mx-auto flex max-w-7xl items-center gap-3 sm:gap-4">
            <Link
              href="/marketplace"
              className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />{" "}
              <span className="hidden sm:inline">Back to The Yamale Vault</span>
              <span className="sm:hidden">Vault</span>
            </Link>
            <span className="min-w-0 truncate text-sm text-muted-foreground" title={item.title}>
              {item.title}
            </span>
          </div>
        </div>
      ) : (
        <div className="border-b border-border bg-card/50 px-4 py-6">
          <div className="mx-auto max-w-3xl">
            <Link
              href="/marketplace"
              className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to The Yamale Vault
            </Link>
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-muted p-4">
                <TypeIcon type={item.type} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize">
                  {item.type}
                </span>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">{item.title}</h1>
                {item.author && (
                  <p className="mt-1 text-muted-foreground">by {item.author}</p>
                )}
                {reviews.totalReviews > 0 && reviews.averageRating !== null && (
                  <div className="mt-2 flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    <span className="text-sm font-medium">{reviews.averageRating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">
                      ({reviews.totalReviews} review{reviews.totalReviews !== 1 ? "s" : ""})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {landingHtml ? <MarketplaceLandingIframe html={landingHtml} title={item.title} /> : null}

      <div className="mx-auto max-w-3xl px-4 py-8">
        {checkoutStatus === "success" && (
          <div className="mb-6 rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            Payment successful. You now have access to this item.
          </div>
        )}
        {checkoutStatus === "cancelled" && (
          <div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            Checkout was cancelled.
          </div>
        )}

        {/* Video section – only show full video for free or owned items */}
        {getYouTubeEmbedUrl(item.video_url ?? null) && (free || owned) && (
          <section className="mb-8">
            <div className="overflow-hidden rounded-xl border border-border bg-black">
              <div className="relative w-full pt-[56.25%]">
                <iframe
                  src={getYouTubeEmbedUrl(item.video_url ?? null) ?? ""}
                  title="Product video"
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </section>
        )}

        {item.description && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold">Description</h2>
            <div className="mt-2 whitespace-pre-wrap text-muted-foreground">
              {item.description}
            </div>
          </section>
        )}

        {owned && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold">Rate this product</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Share your experience to help other practitioners decide if this resource is useful.
            </p>
            <div className="mt-3 flex items-center gap-2">
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
                    aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={`h-6 w-6 ${active ? "fill-current" : "stroke-current"}`}
                    />
                  </button>
                );
              })}
              <span className="ml-2 text-xs text-muted-foreground">
                {myRating ? `You rated this ${myRating}/5` : "Click to rate (1–5 stars)"}
              </span>
            </div>
            {ratingError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{ratingError}</p>
            )}
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-2xl font-semibold">{priceDisplay}</p>
              <p className="text-sm text-muted-foreground">
                {owned
                  ? "You own this item"
                  : free
                    ? "Get instant access"
                    : "One-time payment via mobile money"}
              </p>
            </div>
            {!owned && (
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
                {!free && (
                  <div className="w-full max-w-xs sm:max-w-sm">
                    <PawapayCountrySelect
                      label="Mobile money country"
                      value={pawapayPaymentCountry}
                      onChange={setPawapayPaymentCountry}
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                {free ? (
                  <button
                    type="button"
                    onClick={handleGetFree}
                    disabled={purchasing}
                    className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get for free"}
                  </button>
                ) : (
                  <>
                    {isInCart ? (
                      <button
                        type="button"
                        onClick={handleRemoveFromCart}
                        disabled={addingToCart}
                        className="rounded-lg border border-destructive/50 text-destructive px-4 py-2.5 text-sm font-medium hover:bg-destructive/10 disabled:opacity-50 flex items-center gap-2"
                      >
                        {addingToCart ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <X className="h-4 w-4" />
                            Remove from Cart
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={addingToCart}
                        className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50 flex items-center gap-2"
                      >
                        {addingToCart ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ShoppingCart className="h-4 w-4" />
                            Add to Cart
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handlePurchase}
                      disabled={purchasing}
                      className="rounded-lg px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                      style={{ background: `linear-gradient(to right, ${BRAND.gradientStart}, ${BRAND.gradientEnd})` }}
                    >
                      {purchasing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          Buy Now
                        </>
                      )}
                    </button>
                  </>
                )}
                </div>
              </div>
            )}
          </div>
          {(owned || free) && item.has_file && (
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-6">
              {isZip ? (
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download ZIP
                </button>
              ) : free ? (
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  View
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleView}
                  disabled={viewing}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {viewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  View
                </button>
              )}
              {item.file_format && (
                <span className="text-xs text-muted-foreground">
                  {item.file_name ?? `.${item.file_format}`}
                </span>
              )}
            </div>
          )}
          {(owned || free) && !item.has_file && (
            <p className="mt-6 border-t border-border pt-6 text-sm text-muted-foreground">
              No file is attached to this item. Contact support if you expected a download.
            </p>
          )}
        </section>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}
      </div>

      {viewerUrl && item && !isZip && (
        <FileViewer
          fileUrl={viewerUrl}
          fileName={item.file_name ?? null}
          fileFormat={item.file_format ?? null}
          onClose={handleCloseViewer}
        />
      )}
    </div>
  );
}
