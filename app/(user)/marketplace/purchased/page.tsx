"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Package, ArrowLeft, Loader2, Eye, BookOpen, GraduationCap, FileText, Check, ArrowRight } from "lucide-react";
import { useUser } from "@clerk/nextjs";

const BRAND = {
  dark: "#221913",
  medium: "#603b1c",
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
  accent: "#e3ba65",
};

type Product = {
  id: string;
  type: string;
  title: string;
  author: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  purchased: boolean;
  purchased_at: string;
  has_file?: boolean;
  file_name?: string | null;
  file_format?: string | null;
};

function CategoryIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "book":
      return <BookOpen className={className ?? "h-5 w-5"} />;
    case "course":
      return <GraduationCap className={className ?? "h-5 w-5"} />;
    case "template":
      return <FileText className={className ?? "h-5 w-5"} />;
    default:
      return <FileText className={className ?? "h-5 w-5"} />;
  }
}

export default function PurchasedItemsPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setError("Sign in to view your purchased items");
      setLoading(false);
      return;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    fetch(`${origin}/api/marketplace/purchased`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setItems(Array.isArray(data.items) ? data.items : []);
        }
      })
      .catch(() => {
        setError("Failed to load purchased items");
      })
      .finally(() => setLoading(false));
  }, [isSignedIn, isLoaded]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">Sign in to view your purchased items</p>
        <Link
          href={`/sign-in?redirect_url=${encodeURIComponent("/marketplace/purchased")}`}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-muted/30 via-background to-background">
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-[0.22] blur-[100px] dark:opacity-30"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-40 right-[-10%] h-80 w-80 rounded-full opacity-[0.16] blur-[90px] dark:opacity-25"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-20 sm:px-6 lg:px-8 sm:pt-14">
          <Link
            href="/marketplace"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to marketplace
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/90 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Your purchases
              </p>
              <h1 className="heading mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.5rem]">
                Purchased Items
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
                Access all your purchased books, courses, and templates in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="-mt-10 pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-8 text-center">
              <p className="text-destructive">{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-card/90 px-8 py-16 text-center shadow-sm">
              <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10">
                <Package className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                No purchased items yet
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Purchase items from the marketplace to access them here.
              </p>
              <Link
                href="/marketplace"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/90 px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition hover:brightness-105"
              >
                Browse marketplace
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {items.length} purchased {items.length === 1 ? "item" : "items"}
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {items.map((product) => {
                  return (
                    <Link
                      key={product.id}
                      href={`/marketplace/${product.id}`}
                      className="group relative block overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm shadow-border/40 transition-all duration-200 hover:-translate-y-1 hover:border-primary/70 hover:shadow-lg hover:shadow-primary/20"
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[rgba(193,140,67,0.85)] via-[rgba(227,186,101,0.9)] to-[rgba(154,99,42,0.9)] opacity-70" />
                      <div className="p-5 pt-6">
                        <div className="flex items-start gap-4">
                          {/* Icon / Thumbnail */}
                          <div
                            className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-white shadow-sm shadow-primary/30 transition group-hover:shadow-primary/40"
                            style={{
                              background: `linear-gradient(135deg, ${BRAND.gradientStart}, ${BRAND.gradientEnd})`,
                            }}
                          >
                            {product.image_url ? (
                              <Image
                                src={product.image_url}
                                alt=""
                                width={64}
                                height={64}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <CategoryIcon type={product.type} className="h-7 w-7" />
                            )}
                          </div>

                          {/* Title / Author / Meta */}
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-start gap-2">
                              <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition sm:text-base">
                                {product.title}
                              </h3>
                            </div>
                            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 border border-green-500/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700 dark:bg-green-500/20 dark:border-green-500/40 dark:text-green-300">
                                <Check className="h-3 w-3" aria-hidden />
                                Owned
                              </span>
                              <span className="rounded-full bg-muted/40 px-2.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                                {product.type}
                              </span>
                            </div>
                            {product.author && (
                              <p className="mb-1 text-xs text-muted-foreground">by {product.author}</p>
                            )}
                            {product.description && (
                              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                {product.description}
                              </p>
                            )}
                            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                                Purchased {formatDate(product.purchased_at)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* CTA bar */}
                        <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
                          {product.has_file ? (
                            <span className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                              <Eye className="h-3.5 w-3.5" />
                              View file
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground">
                              View details
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary/80 group-hover:text-primary group-hover:translate-x-0.5 transition">
                            Open
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
