"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, GraduationCap, FileText, Loader2, ArrowLeft, Download, ExternalLink, Star, ShoppingCart, Zap, X } from "lucide-react";
import { useUser } from "@clerk/nextjs";

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

export default function MarketplaceItemPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const id = params?.id as string;

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<{ averageRating: number | null; totalReviews: number }>({ averageRating: null, totalReviews: 0 });
  const [addingToCart, setAddingToCart] = useState(false);
  const [isInCart, setIsInCart] = useState(false);

  const checkoutStatus = searchParams?.get("checkout");
  const sessionId = searchParams?.get("session_id") ?? null;
  const confirmedSessionRef = useRef<string | null>(null);

  const handleViewOrDownload = async (download: boolean) => {
    if (!item?.id || !item.purchased || !item.has_file) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketplace/${item.id}/download`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not get file");
        setDownloading(false);
        return;
      }
      const url = data.url;
      if (url) {
        if (download) {
          const a = document.createElement("a");
          a.href = url;
          a.download = data.file_name || item.file_name || "download";
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.click();
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }
    } catch {
      setError("Something went wrong");
    }
    setDownloading(false);
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
      .then((data: { averageRating?: number | null; totalReviews?: number }) => {
        setReviews({
          averageRating: data.averageRating ?? null,
          totalReviews: data.totalReviews ?? 0,
        });
      })
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
      const res = await fetch("/api/stripe/marketplace-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
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
          ← Back to marketplace
        </Link>
      </div>
    );
  }

  if (!item) return null;

  const owned = item.purchased;
  const free = item.price_cents === 0;
  const priceDisplay = free ? "Free" : `$${(item.price_cents / 100).toFixed(2)}`;

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card/50 px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/marketplace"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to marketplace
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

        {item.description && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold">Description</h2>
            <div className="mt-2 whitespace-pre-wrap text-muted-foreground">
              {item.description}
            </div>
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
                    : "One-time payment via Stripe"}
              </p>
            </div>
            {!owned && (
              <div className="flex gap-2">
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
            )}
          </div>
          {owned && item.has_file && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-6">
              <button
                type="button"
                onClick={() => handleViewOrDownload(false)}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                View
              </button>
              <button
                type="button"
                onClick={() => handleViewOrDownload(true)}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download
              </button>
              {item.file_format && (
                <span className="self-center text-xs text-muted-foreground">
                  {item.file_name ?? `.${item.file_format}`}
                </span>
              )}
            </div>
          )}
          {owned && !item.has_file && (
            <p className="mt-6 border-t border-border pt-6 text-sm text-muted-foreground">
              No file is attached to this item. Contact support if you expected a download.
            </p>
          )}
        </section>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
}
