"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, GraduationCap, FileText, Loader2, ArrowLeft } from "lucide-react";
import { useUser } from "@clerk/nextjs";

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
  const [error, setError] = useState<string | null>(null);

  const checkoutStatus = searchParams?.get("checkout");

  useEffect(() => {
    if (!id) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    fetch(`${origin}/api/marketplace/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.item) setItem(data.item);
        else setError("Item not found");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

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
                  <button
                    type="button"
                    onClick={handlePurchase}
                    disabled={purchasing}
                    className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Purchase"}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
}
