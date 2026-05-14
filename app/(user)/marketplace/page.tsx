"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  BookOpen,
  GraduationCap,
  FileText,
  Check,
  Loader2,
  ShoppingCart,
  X,
  Package,
  LayoutGrid,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useAlertDialog } from "@/components/ui/use-confirm";
import {
  PROTOTYPE_HERO_GRID_PATTERN,
  prototypeHeroEyebrowClass,
  prototypeNavyHeroSectionClass,
} from "@/components/layout/prototype-page-styles";
import { isMarketplaceZip } from "@/lib/marketplace-zip-package";
import { PawapayCountrySelect } from "@/components/checkout/PawapayCountrySelect";
import {
  PaymentMethodPicker,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import { DEFAULT_PAWAPAY_PAYMENT_COUNTRY } from "@/lib/pawapay-payment-countries";

const BRAND = {
  dark: "#221913",
  medium: "#603b1c",
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
  accent: "#e3ba65",
};

type ProductCategory = "book" | "course" | "template" | "guide";

type BrowseMode =
  | { kind: "all" }
  | { kind: "type"; type: ProductCategory };

function parseBrowseMode(categoryParam: string | null): BrowseMode {
  if (!categoryParam) return { kind: "all" };
  if (categoryParam === "all") return { kind: "all" };
  if (categoryParam === "book" || categoryParam === "course" || categoryParam === "template" || categoryParam === "guide") {
    return { kind: "type", type: categoryParam };
  }
  return { kind: "all" };
}

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
  video_url?: string | null;
  file_format?: string | null;
  file_name?: string | null;
};

const TYPE_TILES: {
  param: "all" | ProductCategory;
  label: string;
  blurb: string;
  icon: "all" | ProductCategory;
}[] = [
  { param: "all", label: "All resources", blurb: "Everything in the vault", icon: "all" },
  { param: "book", label: "Books", blurb: "Treatises & references", icon: "book" },
  { param: "course", label: "Courses", blurb: "Structured learning", icon: "course" },
  { param: "template", label: "Templates", blurb: "Ready-to-use documents", icon: "template" },
  { param: "guide", label: "Guides", blurb: "Practical walkthroughs", icon: "guide" },
];

function CategoryIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "book":
      return <BookOpen className={className ?? "h-5 w-5"} />;
    case "course":
      return <GraduationCap className={className ?? "h-5 w-5"} />;
    case "template":
      return <FileText className={className ?? "h-5 w-5"} />;
    case "guide":
      return <BookOpen className={className ?? "h-5 w-5"} />;
    default:
      return <FileText className={className ?? "h-5 w-5"} />;
  }
}

function TileCategoryIcon({ icon, className }: { icon: "all" | ProductCategory; className?: string }) {
  if (icon === "all") {
    return <LayoutGrid className={className ?? "h-8 w-8"} />;
  }
  return <CategoryIcon type={icon} className={className ?? "h-8 w-8"} />;
}

function inferTopic(product: Product): string {
  const text = `${product.title} ${product.description ?? ""} ${product.author}`.toLowerCase();
  if (text.includes("afcfta") || text.includes("origin") || text.includes("customs")) return "AfCFTA Trade";
  if (text.includes("tax") || text.includes("vat")) return "Tax";
  if (text.includes("labour") || text.includes("employment")) return "Labour";
  if (text.includes("mining") || text.includes("extractive")) return "Mining";
  if (text.includes("compliance") || text.includes("due diligence")) return "Compliance";
  if (text.includes("company") || text.includes("corporate") || text.includes("m&a")) return "Corporate";
  return "General";
}

export default function MarketplacePage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [cartItemIds, setCartItemIds] = useState<Set<string>>(new Set());
  const [selectedTopic, setSelectedTopic] = useState("all");
  const { isSignedIn } = useUser();
  const [pawapayPaymentCountry, setPawapayPaymentCountry] = useState(DEFAULT_PAWAPAY_PAYMENT_COUNTRY);
  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>("pawapay");
  const [buyModalProduct, setBuyModalProduct] = useState<Product | null>(null);
  const [buyCheckoutLoading, setBuyCheckoutLoading] = useState(false);
  const confirmedCartSessionRef = useRef<string | null>(null);

  const lomiAvailable =
    process.env.NEXT_PUBLIC_LOMI_CHECKOUT_ENABLED === "1" ||
    Boolean(process.env.NEXT_PUBLIC_LOMI_PUBLISHABLE_KEY?.trim());
  const lomiComingSoon = false;

  useEffect(() => {
    if (!lomiAvailable) setPaymentProvider("pawapay");
  }, [lomiAvailable]);
  const { alert: showAlert, alertDialog } = useAlertDialog();

  const categoryQs = searchParams.get("category");
  const browse = parseBrowseMode(categoryQs);

  useEffect(() => {
    setSearch("");
  }, [categoryQs]);

  const countsByType = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of items) {
      m.set(p.type, (m.get(p.type) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const tileCount = (param: (typeof TYPE_TILES)[number]["param"]) => {
    if (param === "all") return items.length;
    return countsByType.get(param) ?? 0;
  };

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    fetch(`${origin}/api/marketplace`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data.items) ? data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // After cart checkout redirect: confirm payment server-side (avoid treating abandoned pawaPay as paid).
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const paymentVerify = searchParams.get("payment") === "verify";
    const legacySuccess = searchParams.get("checkout") === "success";

    if (
      legacySuccess &&
      !sessionId &&
      typeof window !== "undefined" &&
      window.history.replaceState
    ) {
      const u = new URL(window.location.href);
      u.searchParams.delete("checkout");
      window.history.replaceState({}, "", u.pathname + (u.search ? u.search : ""));
    }

    const shouldConfirm =
      sessionId &&
      (paymentVerify || legacySuccess) &&
      confirmedCartSessionRef.current !== sessionId;

    if (!shouldConfirm) return;

    confirmedCartSessionRef.current = sessionId;

    const confirmAndRefresh = async () => {
      try {
        const res = await fetch("/api/cart/confirm-payment", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
        if (!res.ok || !data.ok) {
          confirmedCartSessionRef.current = null;
        }
      } catch {
        confirmedCartSessionRef.current = null;
      }

      if (typeof window !== "undefined" && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete("session_id");
        url.searchParams.delete("payment");
        url.searchParams.delete("checkout");
        url.searchParams.delete("canceled");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      }

      // Refresh marketplace items so owned flags are updated
      try {
        setLoading(true);
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const r = await fetch(`${origin}/api/marketplace`, { credentials: "include" });
        const data = await r.json();
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    confirmAndRefresh();
  }, [searchParams]);

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

  const filtered = useMemo(() => {
    return items.filter((p) => {
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.author && p.author.toLowerCase().includes(search.toLowerCase()));
      const matchBrowse = browse.kind === "all" || p.type === browse.type;
      return matchSearch && matchBrowse;
    });
  }, [items, browse, search]);

  const topicOptions = useMemo(() => {
    const topics = new Set<string>(["all"]);
    for (const product of items) topics.add(inferTopic(product));
    return Array.from(topics);
  }, [items]);

  const filteredByTopic = useMemo(() => {
    if (selectedTopic === "all") return filtered;
    return filtered.filter((product) => inferTopic(product) === selectedTopic);
  }, [filtered, selectedTopic]);

  const browseTitle =
    browse.kind === "all"
        ? "All resources"
        : TYPE_TILES.find((t) => t.param === browse.type)?.label ?? browse.type;

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
        await showAlert(data.error ?? "Failed to add to cart", "Cart");
      }
    } catch {
      await showAlert("Something went wrong", "Cart");
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
        await showAlert(data.error ?? "Failed to remove from cart", "Cart");
      }
    } catch {
      await showAlert("Something went wrong", "Cart");
    } finally {
      setAddingToCart(null);
    }
  };

  const openBuyModal = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent("/marketplace")}`;
      return;
    }
    setBuyModalProduct(product);
  };

  const submitBuyCheckout = async () => {
    if (!buyModalProduct) return;
    setBuyCheckoutLoading(true);
    try {
      const res = await fetch("/api/payments/marketplace-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          itemId: buyModalProduct.id,
          provider: paymentProvider,
          ...(paymentProvider === "pawapay" ? { paymentCountry: pawapayPaymentCountry } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url as string;
        return;
      }
      await showAlert(data.error ?? "Checkout failed", "Checkout");
    } catch {
      await showAlert("Something went wrong", "Checkout");
    } finally {
      setBuyCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {alertDialog}
      <Dialog.Root
        open={buyModalProduct != null}
        onOpenChange={(open) => {
          if (!open) {
            setBuyModalProduct(null);
            setBuyCheckoutLoading(false);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm print:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex max-h-[min(90vh,640px)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card shadow-2xl print:hidden focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="border-b border-border px-5 py-4 pr-12">
              <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">
                Choose payment method
              </Dialog.Title>
              {buyModalProduct ? (
                <Dialog.Description asChild>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground line-clamp-2">{buyModalProduct.title}</p>
                    <p>
                      {buyModalProduct.price_cents === 0
                        ? "Free"
                        : `$${(buyModalProduct.price_cents / 100).toFixed(2)}`}
                    </p>
                  </div>
                </Dialog.Description>
              ) : (
                <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                  Select how you would like to pay.
                </Dialog.Description>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                {lomiAvailable && (
                  <PaymentMethodPicker
                    value={paymentProvider}
                    onChange={setPaymentProvider}
                    lomiAvailable={lomiAvailable}
                    lomiComingSoon={lomiComingSoon}
                  />
                )}
                {paymentProvider === "pawapay" && (
                  <PawapayCountrySelect
                    label="Mobile money country"
                    value={pawapayPaymentCountry}
                    onChange={setPawapayPaymentCountry}
                  />
                )}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/30 px-5 py-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={buyCheckoutLoading}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void submitBuyCheckout()}
                disabled={buyCheckoutLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {buyCheckoutLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Redirecting…
                  </>
                ) : (
                  "Continue to payment"
                )}
              </button>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                aria-label="Close"
                disabled={buyCheckoutLoading}
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <section className={`relative overflow-hidden ${prototypeNavyHeroSectionClass}`}>
        <div
          className="absolute inset-0 z-0"
          style={{ backgroundImage: PROTOTYPE_HERO_GRID_PATTERN }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pt-14 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className={prototypeHeroEyebrowClass}>
                The Yamalé Vault
              </p>
              <h1 className="heading mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.6rem]">
                The Yamale Vault
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/[0.7] sm:text-base">
                Premium legal education and practical resources built for African legal professionals. Learn, download,
                and apply with confidence.
              </p>
            </div>
            {isSignedIn && (
              <div className="flex items-center gap-3">
                <Link
                  href="/marketplace/purchased"
                  className="inline-flex items-center gap-2 rounded-[6px] border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                >
                  <Package className="h-5 w-5 text-[#E8B84B]" />
                  <span>Purchased</span>
                </Link>
                <Link
                  href="/marketplace/cart"
                  className="relative inline-flex items-center gap-2 rounded-[6px] border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                >
                  <ShoppingCart className="h-5 w-5 text-[#E8B84B]" />
                  <span>Cart</span>
                  {cartCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#C8922A] text-[10px] font-bold text-white">
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="pb-16 pt-9">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[8px] border border-border bg-muted p-4 text-sm leading-relaxed text-muted-foreground">
            Content in The Yamale Vault including courses, webinars, templates, and documents is provided for
            educational and informational purposes. It does not constitute legal advice for any specific situation.
            <strong> Templates should be reviewed by qualified legal counsel before use.</strong> Yamale Alliance is not
            responsible for outcomes arising from use without independent legal review.
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="min-w-[72px] text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Format</span>
              {TYPE_TILES.map((tile) => {
                const active =
                  (browse.kind === "all" && tile.param === "all") ||
                  (browse.kind === "type" && tile.param === browse.type);
                return (
                  <Link
                    key={tile.param}
                    href={`/marketplace?category=${encodeURIComponent(tile.param)}`}
                    scroll={false}
                    className={`rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-[#C8922A] bg-[#C8922A] text-white"
                        : "border-border bg-card text-muted-foreground hover:border-[#d8c5a1]"
                    }`}
                  >
                    {tile.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="min-w-[72px] text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Topic</span>
              {topicOptions.map((topic) => (
                <button
                  type="button"
                  key={topic}
                  onClick={() => setSelectedTopic(topic)}
                  className={`rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition ${
                    selectedTopic === topic
                      ? "border-[#C8922A] bg-[#C8922A] text-white"
                      : "border-border bg-card text-muted-foreground hover:border-[#d8c5a1]"
                  }`}
                >
                  {topic === "all" ? "All topics" : topic}
                </button>
              ))}
            </div>

            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search resources..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-[8px] border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-[#C8922A]"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredByTopic.length === 0 ? (
            <div className="mt-8 rounded-[10px] border border-dashed border-border bg-card px-8 py-12 text-center">
              <h3 className="text-xl font-semibold text-foreground">No resources match your filters</h3>
              <p className="mt-2 text-sm text-muted-foreground">Try another format, topic, or broader search keyword.</p>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {filteredByTopic.map((product) => {
                    const priceLabel = product.price_cents === 0 ? "Free" : `$${(product.price_cents / 100).toFixed(2)}`;

                    return (
                      <Link
                        key={product.id}
                        href={
                          isMarketplaceZip(product)
                            ? `/marketplace/${product.id}/package`
                            : `/marketplace/${product.id}`
                        }
                        className="group block overflow-hidden rounded-[8px] border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div
                          className="relative h-36 border-b border-border"
                          style={{ background: `linear-gradient(135deg, ${BRAND.gradientStart}, ${BRAND.gradientEnd})` }}
                        >
                          {product.image_url ? (
                            <Image src={product.image_url} alt="" fill className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/95">
                              <CategoryIcon type={product.type} className="h-9 w-9" />
                            </div>
                          )}
                          <div className="absolute left-3 top-3">
                            <span className="rounded-full bg-[#0D1B2A] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">
                              {product.type === "course" ? "Course" : product.type === "guide" ? "Guide" : product.type === "template" ? "Template" : "Book"}
                            </span>
                          </div>
                          <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#0D1B2A]">
                            {priceLabel}
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="line-clamp-2 text-[14px] font-bold leading-snug text-foreground">{product.title}</h3>
                          <p className="mt-1 text-[12px] text-muted-foreground">
                            {product.author || "Yamale Faculty"} {product.owned ? "· Owned" : ""}
                          </p>
                          <div className="mt-1 text-[11px] text-muted-foreground/80">
                            {product.type === "course" ? "Structured modules" : product.type === "template" ? "Instant download" : "Reference material"}
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                            <span className="text-[12px] font-medium text-muted-foreground">{inferTopic(product)}</span>
                            <div className="flex items-center gap-2">
                              {isMarketplaceZip(product) && !product.owned && (
                                <span className="rounded-[6px] border border-[#C8922A]/40 bg-[#C8922A]/10 px-2 py-1 text-[11px] font-semibold text-[#b8893b]">
                                  View package
                                  {product.price_cents === 0 ? " · Free" : ""}
                                </span>
                              )}
                              {isSignedIn && !product.owned && product.price_cents > 0 && !isMarketplaceZip(product) && (
                                <>
                                  {cartItemIds.has(product.id) ? (
                                    <button
                                      type="button"
                                      onClick={(e) => handleRemoveFromCart(product.id, e)}
                                      disabled={addingToCart === product.id}
                                      className="rounded-[6px] border border-red-300 px-2 py-1 text-[11px] font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                                    >
                                      {addingToCart === product.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => handleAddToCart(product.id, e)}
                                      disabled={addingToCart === product.id}
                                      className="rounded-[6px] border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                                    >
                                      {addingToCart === product.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => openBuyModal(product, e)}
                                    className="rounded-[6px] bg-[#0D1B2A] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#162436]"
                                  >
                                    Buy
                                  </button>
                                </>
                              )}
                              {product.owned && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                                  <Check className="h-3 w-3" />
                                  Owned
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
