"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, BookOpen, GraduationCap, FileText, Check, Loader2, ShoppingCart, Zap, X, Package } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const BRAND = {
  dark: "#221913",
  medium: "#603b1c",
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
  accent: "#e3ba65",
};

type ProductCategory = "book" | "course" | "template" | "";

type Product = {
  id: string;
  type: string;
  title: string;
  author: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  sort_order: number;
  owned?: boolean;
};

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "", label: "All" },
  { value: "book", label: "Books" },
  { value: "course", label: "Courses" },
  { value: "template", label: "Templates" },
];

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

export default function MarketplacePage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory>("");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [cartItemIds, setCartItemIds] = useState<Set<string>>(new Set());
  const { isSignedIn } = useUser();

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    fetch(`${origin}/api/marketplace`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data.items) ? data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // Fetch cart items
  useEffect(() => {
    if (!isSignedIn) {
      setCartCount(0);
      setCartItemIds(new Set());
      return;
    }
    fetch("/api/cart", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { cart?: Array<{ marketplace_item_id: string; quantity: number }> }) => {
        const cart = data.cart ?? [];
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        const itemIds = new Set(cart.map((item) => item.marketplace_item_id));
        setCartCount(count);
        setCartItemIds(itemIds);
      })
      .catch(() => {
        setCartCount(0);
        setCartItemIds(new Set());
      });
  }, [isSignedIn]);

  // Refresh cart when items are added/removed
  const refreshCart = () => {
    if (!isSignedIn) return;
    fetch("/api/cart", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { cart?: Array<{ marketplace_item_id: string; quantity: number }> }) => {
        const cart = data.cart ?? [];
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        const itemIds = new Set(cart.map((item) => item.marketplace_item_id));
        setCartCount(count);
        setCartItemIds(itemIds);
      })
      .catch(() => {});
  };

  const filtered = items.filter((p) => {
    const matchSearch =
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.author && p.author.toLowerCase().includes(search.toLowerCase()));
    const matchCategory = !category || p.type === category;
    return matchSearch && matchCategory;
  });

  const handleAddToCart = async (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent("/marketplace")}`;
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
        refreshCart();
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to add to cart");
      }
    } catch {
      alert("Something went wrong");
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
        refreshCart();
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to remove from cart");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setAddingToCart(null);
    }
  };

  const handleBuyNow = async (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent("/marketplace")}`;
      return;
    }
    // Direct checkout for single item
    try {
      const res = await fetch("/api/stripe/marketplace-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemId: productId }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Checkout failed");
      }
    } catch {
      alert("Something went wrong");
    }
  };

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
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/90 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Curated African legal knowledge
              </p>
              <h1 className="heading mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.5rem]">
                Knowledge &amp; Training Marketplace
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
                Books, courses, and templates built for African legal practice—discover resources
                you can actually use in court, negotiations, and compliance work.
              </p>
            </div>
            {isSignedIn && (
              <div className="flex items-center gap-3">
                <Link
                  href="/marketplace/purchased"
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-background/80 px-4 py-2.5 text-sm font-medium text-foreground shadow-sm shadow-primary/20 backdrop-blur transition hover:border-primary/70 hover:bg-primary/10 hover:shadow-md"
                >
                  <Package className="h-5 w-5 text-primary" />
                  <span>Purchased</span>
                </Link>
                <Link
                  href="/marketplace/cart"
                  className="relative inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-background/80 px-4 py-2.5 text-sm font-medium text-foreground shadow-sm shadow-primary/20 backdrop-blur transition hover:border-primary/70 hover:bg-primary/10 hover:shadow-md"
                >
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <span>Cart</span>
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Filters + results */}
      <section className="-mt-10 pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Search & filters card */}
          <div className="mb-8 rounded-2xl border border-border/70 bg-card/95 p-5 shadow-lg shadow-primary/10 backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="w-full md:max-w-xl">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    placeholder="Search by title, author, jurisdiction, or topic..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background/90 pl-10 pr-4 py-2.5 text-sm shadow-sm outline-none ring-0 transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              <div className="w-full md:max-w-xs">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                  Category
                </p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(({ value, label }) => {
                    const active = category === value;
                    return (
                      <button
                        key={value || "all"}
                        type="button"
                        onClick={() => setCategory(value)}
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition ${
                          active
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border/70 bg-background/80 text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing <span className="font-semibold text-foreground">{filtered.length}</span> item
                  {filtered.length !== 1 ? "s" : ""}
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-card/80 px-8 py-12 text-center shadow-sm">
                  <div className="mb-4 text-5xl">📚</div>
                  <h3 className="text-xl font-semibold text-foreground">
                    No resources match your search
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try broadening your keywords or clearing filters to explore the full marketplace.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setCategory("");
                    }}
                    className="mt-6 inline-flex items-center justify-center rounded-xl border border-primary/60 bg-primary/10 px-5 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:bg-primary/20"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((product) => {
                    const priceLabel = product.price_cents === 0 ? "Free" : `$${(product.price_cents / 100).toFixed(2)}`;

                    return (
                      <Link
                        key={product.id}
                        href={`/marketplace/${product.id}`}
                        className="group relative block overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm shadow-border/40 transition hover:-translate-y-1 hover:border-primary/70 hover:shadow-lg hover:shadow-primary/20"
                      >
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[rgba(193,140,67,0.85)] via-[rgba(227,186,101,0.9)] to-[rgba(154,99,42,0.9)] opacity-70" />
                        <div className="p-5 pt-6">
                          <div className="flex items-start gap-4">
                            {/* Icon / Thumbnail */}
                            <div
                              className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-white shadow-sm shadow-primary/30"
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
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">
                                  {product.title}
                                </h3>
                                {product.owned && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-green-600 dark:bg-green-500/20 dark:text-green-300">
                                    <Check className="h-3 w-3" aria-hidden />
                                    Owned
                                  </span>
                                )}
                                <span className="rounded-full bg-muted/30 px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
                                  {product.type}
                                </span>
                              </div>
                              {product.author && (
                                <p className="text-xs text-muted-foreground">by {product.author}</p>
                              )}
                              {product.description && (
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {product.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Price / CTA bar */}
                          <div className="mt-4 flex items-center gap-3 border-t border-border/70 pt-3">
                            <span className="text-sm font-semibold text-foreground">
                              {priceLabel}
                            </span>
                            <div className="ml-auto flex items-center gap-2">
                              {isSignedIn && !product.owned && product.price_cents > 0 && (
                                <>
                                  {cartItemIds.has(product.id) ? (
                                    <button
                                      type="button"
                                      onClick={(e) => handleRemoveFromCart(product.id, e)}
                                      disabled={addingToCart === product.id}
                                      className="inline-flex items-center gap-1.5 rounded-full border border-destructive/60 px-3 py-1 text-[11px] font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                                      aria-label="Remove from cart"
                                    >
                                      {addingToCart === product.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <X className="h-3 w-3" />
                                      )}
                                      Remove
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => handleAddToCart(product.id, e)}
                                      disabled={addingToCart === product.id}
                                      className="inline-flex items-center gap-1.5 rounded-full border border-border/80 px-3 py-1 text-[11px] font-medium text-foreground transition hover:border-primary hover:bg-primary/10 disabled:opacity-50"
                                      aria-label="Add to cart"
                                    >
                                      {addingToCart === product.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <ShoppingCart className="h-3 w-3" />
                                      )}
                                      Add
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => handleBuyNow(product.id, e)}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[rgba(154,99,42,0.95)] to-[rgba(193,140,67,0.95)] px-3 py-1 text-[11px] font-medium text-primary-foreground shadow-sm transition hover:brightness-105"
                                    aria-label="Buy now"
                                  >
                                    <Zap className="h-3 w-3" />
                                    Buy now
                                  </button>
                                </>
                              )}
                              <span className="text-[11px] font-semibold text-primary/90 group-hover:translate-x-0.5 group-hover:text-primary transition">
                                View details →
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
