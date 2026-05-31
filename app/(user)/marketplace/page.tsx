"use client";

import { Fragment, useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Search,
  BookOpen,
  GraduationCap,
  FileText,
  Check,
  Loader2,
  ShoppingCart,
  Package,
  LayoutGrid,
  Gift,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useClientSearchParams } from "@/lib/use-client-search-params";
import { useAlertDialog } from "@/components/ui/use-confirm";
import {
  PROTOTYPE_HERO_GRID_PATTERN,
  prototypeHeroEyebrowClass,
  prototypeNavyHeroSectionClass,
} from "@/components/layout/prototype-page-styles";
import { isMarketplaceZip } from "@/lib/marketplace-zip-package";
import { DEFAULT_PAWAPAY_PAYMENT_COUNTRY } from "@/lib/pawapay-payment-countries";
import { useMarketplacePaymentReturn } from "@/components/marketplace/use-marketplace-payment-return";
import { notifyMarketplaceCartUpdated } from "@/lib/marketplace-cart-events";
import {
  MarketplaceVaultCheckoutDialog,
  type MarketplaceVaultCheckoutChoice,
} from "@/components/marketplace/MarketplaceVaultCheckoutDialog";
import type { CheckoutPaymentProvider } from "@/components/checkout/PaymentMethodPicker";
import {
  VAULT_BROWSE_FREE,
  VAULT_SUBCATEGORIES,
  compareVaultSeriesOrder,
  isFreeVaultItem,
  isPaidVaultSubcategory,
  labelForVaultSubcategory,
  parseVaultSeriesParam,
  shouldCollapseVaultSeries,
  shouldGroupVaultItem,
  type VaultSubcategoryId,
} from "@/lib/marketplace-vault-categories";
import {
  computeSeriesOfferFromBrowseItems,
  type MarketplaceSeriesOffer,
} from "@/lib/marketplace-series-offers";
import type { MarketplaceItemPackOffer } from "@/lib/marketplace-item-packs";
import { MarketplaceProductCard } from "@/components/marketplace/MarketplaceProductCard";
import {
  VAULT_SORT_OPTIONS,
  buildMarketplaceSearchQuery,
  parseVaultSortParam,
  sortVaultProducts,
} from "@/lib/marketplace-vault-sort";

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
  | { kind: "type"; type: ProductCategory }
  | { kind: "free"; subcategory: VaultSubcategoryId | null };

function parseBrowseMode(categoryParam: string | null, seriesParam: string | null): BrowseMode {
  if (!categoryParam || categoryParam === "all" || categoryParam === "series") return { kind: "all" };
  if (categoryParam === VAULT_BROWSE_FREE) {
    const sub = parseVaultSeriesParam(seriesParam);
    return { kind: "free", subcategory: sub && !isPaidVaultSubcategory(sub) ? sub : null };
  }
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
  created_at?: string;
  owned?: boolean;
  video_url?: string | null;
  file_format?: string | null;
  file_name?: string | null;
  vault_subcategory?: string | null;
};

type DisplayProductCard = {
  product: Product;
  collectionHref?: string;
  collectionCount?: number;
  collectionLabel?: string;
  /** Free vault subcategory slug for inline expand (e.g. at_a_glance). */
  seriesKey?: string;
};

function normalizeSeriesImages(items: Product[]): Product[] {
  if (!items.length) return items;

  const sharedImageBySubcategory = new Map<string, string>();

  for (const item of items) {
    if (!shouldGroupVaultItem(item)) continue;
    const sub = item.vault_subcategory?.trim();
    if (!sub) continue;
    if (sharedImageBySubcategory.has(sub)) continue;
    if (!item.image_url) continue;
    sharedImageBySubcategory.set(sub, item.image_url);
  }

  if (!sharedImageBySubcategory.size) return items;

  return items.map((item) => {
    if (!shouldGroupVaultItem(item)) return item;
    const sub = item.vault_subcategory?.trim();
    if (!sub) return item;
    const shared = sharedImageBySubcategory.get(sub);
    if (!shared) return item;
    if (item.image_url === shared) return item;
    return { ...item, image_url: shared };
  });
}

const FORMAT_TILES: {
  param: "all" | ProductCategory | typeof VAULT_BROWSE_FREE;
  label: string;
  blurb: string;
  icon: "all" | ProductCategory | "free";
}[] = [
  { param: "all", label: "All resources", blurb: "Everything in the vault", icon: "all" },
  { param: VAULT_BROWSE_FREE, label: "Free", blurb: "Complimentary resources", icon: "free" },
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

function TileCategoryIcon({
  icon,
  className,
}: {
  icon: "all" | ProductCategory | "free";
  className?: string;
}) {
  if (icon === "all") {
    return <LayoutGrid className={className ?? "h-8 w-8"} />;
  }
  if (icon === "free") {
    return <Gift className={className ?? "h-8 w-8"} />;
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
  const router = useRouter();
  const searchParams = useClientSearchParams();
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
  const [buyModalSeriesOffer, setBuyModalSeriesOffer] = useState<MarketplaceSeriesOffer | null>(null);
  const [buyModalPackOffer, setBuyModalPackOffer] = useState<MarketplaceItemPackOffer | null>(null);
  const [buyModalSeriesId, setBuyModalSeriesId] = useState<VaultSubcategoryId | null>(null);
  const [checkoutChoice, setCheckoutChoice] = useState<MarketplaceVaultCheckoutChoice>("item");
  const [buyCheckoutLoading, setBuyCheckoutLoading] = useState(false);
  const [expandedSeriesKey, setExpandedSeriesKey] = useState<string | null>(null);

  const lomiAvailable =
    process.env.NEXT_PUBLIC_LOMI_CHECKOUT_ENABLED === "1" ||
    Boolean(process.env.NEXT_PUBLIC_LOMI_PUBLISHABLE_KEY?.trim());
  const lomiComingSoon = false;

  useEffect(() => {
    if (!lomiAvailable) setPaymentProvider("pawapay");
  }, [lomiAvailable]);
  const { alert: showAlert, alertDialog } = useAlertDialog();

  const categoryQs = searchParams.get("category");
  const seriesQs = searchParams.get("series");
  const vaultSort = parseVaultSortParam(searchParams.get("sort"));
  const browse = parseBrowseMode(categoryQs, seriesQs);

  const marketplaceQuery = useCallback(
    (overrides?: { category?: string | null; series?: string | null; sort?: typeof vaultSort }) =>
      buildMarketplaceSearchQuery({
        category: overrides?.category !== undefined ? overrides.category : categoryQs,
        series: overrides?.series !== undefined ? overrides.series : seriesQs,
        sort: overrides?.sort ?? vaultSort,
      }),
    [categoryQs, seriesQs, vaultSort]
  );

  const setVaultSort = useCallback(
    (sort: typeof vaultSort) => {
      const qs = marketplaceQuery({ sort });
      router.replace(qs ? `/marketplace?${qs}` : "/marketplace", { scroll: false });
    },
    [marketplaceQuery, router]
  );

  useEffect(() => {
    setSearch("");
  }, [categoryQs, seriesQs]);

  const countsByType = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of items) {
      m.set(p.type, (m.get(p.type) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const freeItemCount = useMemo(() => items.filter((p) => isFreeVaultItem(p.price_cents)).length, [items]);

  const formatTileCount = (param: (typeof FORMAT_TILES)[number]["param"]) => {
    if (param === "all") return items.length;
    if (param === VAULT_BROWSE_FREE) return freeItemCount;
    return countsByType.get(param) ?? 0;
  };

  const freeSeriesCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of items) {
      if (!isFreeVaultItem(p.price_cents)) continue;
      const key = p.vault_subcategory?.trim() || "";
      if (!key || isPaidVaultSubcategory(key)) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const refreshItems = useCallback(async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const r = await fetch(`${origin}/api/marketplace`, { credentials: "include" });
      const data = await r.json();
      const rawItems: Product[] = Array.isArray(data.items) ? data.items : [];
      setItems(normalizeSeriesImages(rawItems));
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void refreshItems().finally(() => setLoading(false));
  }, [refreshItems]);

  const { paymentVerifyInProgress, showVerifiedPaymentSuccess } = useMarketplacePaymentReturn({
    mode: "cart",
    clearParamsPathname: "/marketplace",
    onConfirmed: refreshItems,
  });

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
        notifyMarketplaceCartUpdated();
      })
      .catch(() => {});
  };

  const filtered = useMemo(() => {
    return items.filter((p) => {
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.author && p.author.toLowerCase().includes(search.toLowerCase()));
      const matchBrowse =
        browse.kind === "all"
          ? true
          : browse.kind === "type"
            ? p.type === browse.type
            : isFreeVaultItem(p.price_cents) &&
              (!browse.subcategory || p.vault_subcategory === browse.subcategory);
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

  const sortedProducts = useMemo(
    () => sortVaultProducts(filteredByTopic, vaultSort),
    [filteredByTopic, vaultSort]
  );

  const { displayCards, seriesMembersByKey } = useMemo(() => {
    const freeSubcategory = browse.kind === "free" ? browse.subcategory : null;
    const collapseSeries = shouldCollapseVaultSeries(
      browse.kind === "free" ? "free" : browse.kind === "type" ? "type" : "all",
      freeSubcategory
    );

    if (!collapseSeries) {
      return {
        displayCards: sortedProducts.map((product) => ({ product })) as DisplayProductCard[],
        seriesMembersByKey: new Map<string, Product[]>(),
      };
    }

    const membersByKey = new Map<string, Product[]>();
    const regularProducts: Product[] = [];

    for (const product of sortedProducts) {
      const subcategory = product.vault_subcategory?.trim() ?? "";
      if (shouldGroupVaultItem(product) && subcategory) {
        const members = membersByKey.get(subcategory) ?? [];
        members.push(product);
        membersByKey.set(subcategory, members);
      } else {
        regularProducts.push(product);
      }
    }

    const seriesCards: DisplayProductCard[] = Array.from(membersByKey.entries())
      .sort(([a], [b]) => compareVaultSeriesOrder(a, b))
      .map(([subcategory, members]) => {
        const coverProduct = members.find((m) => m.image_url) ?? members[0];
        return {
          product: coverProduct,
          collectionLabel: labelForVaultSubcategory(subcategory) ?? "Series",
          collectionCount: members.length,
          seriesKey: subcategory,
        };
      });

    const regularCards: DisplayProductCard[] = regularProducts.map((product) => ({ product }));

    return {
      displayCards: [...seriesCards, ...regularCards],
      seriesMembersByKey: membersByKey,
    };
  }, [browse, sortedProducts]);

  const toggleSeries = useCallback((seriesKey: string) => {
    setExpandedSeriesKey((prev) => (prev === seriesKey ? null : seriesKey));
  }, []);

  useEffect(() => {
    setExpandedSeriesKey(null);
  }, [categoryQs, seriesQs]);

  const browseTitle =
    browse.kind === "all"
      ? "All resources"
      : browse.kind === "free"
        ? browse.subcategory
          ? (labelForVaultSubcategory(browse.subcategory) ?? "Free")
          : "Free"
        : FORMAT_TILES.find((t) => t.param === browse.type)?.label ?? browse.type;

  const closeBuyModal = () => {
    setBuyModalProduct(null);
    setBuyModalSeriesOffer(null);
    setBuyModalPackOffer(null);
    setBuyModalSeriesId(null);
    setBuyCheckoutLoading(false);
    setCheckoutChoice("item");
  };

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
    setCheckoutChoice("item");
    setBuyModalPackOffer(null);
    const seriesId = product.vault_subcategory?.trim();
    if (seriesId && isPaidVaultSubcategory(seriesId)) {
      const members = items.filter((p) => p.vault_subcategory === seriesId);
      const offer = computeSeriesOfferFromBrowseItems(seriesId as VaultSubcategoryId, members);
      setBuyModalSeriesOffer(offer);
      setBuyModalSeriesId(seriesId as VaultSubcategoryId);
    } else {
      setBuyModalSeriesOffer(null);
      setBuyModalSeriesId(null);
    }
    if (product.price_cents > 0) {
      fetch(`/api/marketplace/${product.id}/pack-offer`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { offer?: MarketplaceItemPackOffer } | null) => {
          setBuyModalPackOffer(data?.offer ?? null);
        })
        .catch(() => setBuyModalPackOffer(null));
    }
  };

  const openSeriesBuyModal = (seriesId: VaultSubcategoryId, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent("/marketplace")}`;
      return;
    }
    const members = items.filter((p) => p.vault_subcategory === seriesId);
    const offer = computeSeriesOfferFromBrowseItems(seriesId, members);
    setBuyModalProduct(null);
    setBuyModalSeriesOffer(offer);
    setBuyModalPackOffer(null);
    setBuyModalSeriesId(seriesId);
    setCheckoutChoice("series");
  };

  const submitBuyCheckout = async () => {
    if (!buyModalProduct && !buyModalSeriesId) return;
    setBuyCheckoutLoading(true);
    try {
      const useSeries =
        checkoutChoice === "series" && buyModalSeriesId && buyModalSeriesOffer && !buyModalSeriesOffer.fullyOwned;
      const usePack = checkoutChoice === "pack" && buyModalPackOffer?.packEligible;
      const checkoutUrl = useSeries
        ? "/api/payments/marketplace-series-checkout"
        : usePack
          ? "/api/payments/marketplace-pack-checkout"
          : "/api/payments/marketplace-checkout";
      const res = await fetch(checkoutUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...(useSeries
              ? {
                  seriesId: buyModalSeriesId,
                  success_path: "/marketplace",
                }
              : usePack
                ? {
                    anchorItemId: buyModalPackOffer!.anchorItemId,
                    success_path: "/marketplace",
                  }
                : { itemId: buyModalProduct!.id }),
            provider: paymentProvider,
            ...(paymentProvider === "pawapay" ? { paymentCountry: pawapayPaymentCountry } : {}),
          }),
        }
      );
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
      <MarketplaceVaultCheckoutDialog
        open={buyModalProduct != null || buyModalSeriesId != null}
        onOpenChange={(open) => {
          if (!open) closeBuyModal();
        }}
        product={buyModalProduct}
        seriesOffer={buyModalSeriesOffer}
        packOffer={buyModalPackOffer}
        choice={checkoutChoice}
        onChoiceChange={setCheckoutChoice}
        paymentProvider={paymentProvider}
        onPaymentProviderChange={setPaymentProvider}
        pawapayPaymentCountry={pawapayPaymentCountry}
        onPawapayPaymentCountryChange={setPawapayPaymentCountry}
        lomiAvailable={lomiAvailable}
        lomiComingSoon={lomiComingSoon}
        loading={buyCheckoutLoading}
        onCheckout={() => void submitBuyCheckout()}
      />
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
      {(paymentVerifyInProgress || showVerifiedPaymentSuccess) && (
        <div className="border-b border-border bg-card px-4 py-3">
          <div className="mx-auto max-w-7xl text-sm">
            {paymentVerifyInProgress && (
              <p className="text-muted-foreground">Confirming your payment…</p>
            )}
            {showVerifiedPaymentSuccess && !paymentVerifyInProgress && (
              <p className="font-medium text-green-700 dark:text-green-400">
                Payment successful. Your purchased items are now available — open them below or under Purchased.
              </p>
            )}
          </div>
        </div>
      )}
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
              {FORMAT_TILES.map((tile) => {
                const active =
                  (browse.kind === "all" && tile.param === "all") ||
                  (browse.kind === "type" && tile.param === browse.type) ||
                  (browse.kind === "free" && tile.param === VAULT_BROWSE_FREE && !browse.subcategory);
                const qs = marketplaceQuery({
                  category: tile.param === "all" ? null : tile.param,
                  series: null,
                });
                return (
                  <Link
                    key={tile.param}
                    href={qs ? `/marketplace?${qs}` : "/marketplace"}
                    scroll={false}
                    className={`rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-[#C8922A] bg-[#C8922A] text-white"
                        : "border-border bg-card text-muted-foreground hover:border-[#d8c5a1]"
                    }`}
                  >
                    {tile.label}
                    {formatTileCount(tile.param) > 0 ? ` (${formatTileCount(tile.param)})` : ""}
                  </Link>
                );
              })}
            </div>

            {browse.kind === "free" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="min-w-[72px] text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Series
                </span>
                <Link
                  href={`/marketplace?${marketplaceQuery({ category: "free", series: null })}`}
                  scroll={false}
                  className={`rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition ${
                    !browse.subcategory
                      ? "border-[#C8922A] bg-[#C8922A] text-white"
                      : "border-border bg-card text-muted-foreground hover:border-[#d8c5a1]"
                  }`}
                >
                  All free
                  {freeItemCount > 0 ? ` (${freeItemCount})` : ""}
                </Link>
                {VAULT_SUBCATEGORIES.filter((s) => !s.paid).map((series) => {
                  const count = freeSeriesCounts.get(series.id) ?? 0;
                  const active = browse.subcategory === series.id;
                  return (
                    <Link
                      key={series.id}
                      href={`/marketplace?${marketplaceQuery({ category: "free", series: series.id })}`}
                      scroll={false}
                      className={`rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "border-[#C8922A] bg-[#C8922A] text-white"
                          : "border-border bg-card text-muted-foreground hover:border-[#d8c5a1]"
                      }`}
                    >
                      {series.label}
                      {count > 0 ? ` (${count})` : ""}
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="min-w-[72px] text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sort</span>
              {VAULT_SORT_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setVaultSort(opt.value)}
                  className={`rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition ${
                    vaultSort === opt.value
                      ? "border-[#C8922A] bg-[#C8922A] text-white"
                      : "border-border bg-card text-muted-foreground hover:border-[#d8c5a1]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
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
          ) : displayCards.length === 0 ? (
            <div className="mt-8 rounded-[10px] border border-dashed border-border bg-card px-8 py-12 text-center">
              <h3 className="text-xl font-semibold text-foreground">No resources match your filters</h3>
              <p className="mt-2 text-sm text-muted-foreground">Try another format, topic, or broader search keyword.</p>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayCards.map((card) => {
                const seriesKey = card.seriesKey;
                const isInlineCollection = Boolean(seriesKey && card.collectionLabel);
                const expanded = isInlineCollection && expandedSeriesKey === seriesKey;
                const members =
                  seriesKey && expanded ? (seriesMembersByKey.get(seriesKey) ?? []) : [];
                const paidSeriesSummary =
                  seriesKey && isInlineCollection && isPaidVaultSubcategory(seriesKey)
                    ? (() => {
                        const seriesMembers = seriesMembersByKey.get(seriesKey) ?? [];
                        const offer = computeSeriesOfferFromBrowseItems(
                          seriesKey as VaultSubcategoryId,
                          seriesMembers
                        );
                        if (!offer) return null;
                        return {
                          chargeCents: offer.chargeCents,
                          totalCents: offer.totalCents,
                          bundleCents: offer.bundleCents,
                          bundleSavingsCents: offer.bundleSavingsCents,
                          ownedCount: offer.ownedCount,
                          itemCount: offer.itemCount,
                          fullyOwned: offer.fullyOwned,
                        };
                      })()
                    : null;

                const renderProductCard = (
                  product: Product,
                  opts?: { iconOnlyMedia?: boolean; keySuffix?: string }
                ) => (
                  <MarketplaceProductCard
                    key={`${product.id}${opts?.keySuffix ?? ""}`}
                    product={product}
                    topicLabel={inferTopic(product)}
                    typeBadgeLabel={
                      product.type === "course"
                        ? "Course"
                        : product.type === "guide"
                          ? "Guide"
                          : product.type === "template"
                            ? "Template"
                            : "Book"
                    }
                    formatHint={
                      product.type === "course"
                        ? "Structured modules"
                        : product.type === "template"
                          ? "Instant download"
                          : "Reference material"
                    }
                    seriesLabel={
                      isFreeVaultItem(product.price_cents) && !opts?.iconOnlyMedia
                        ? labelForVaultSubcategory(product.vault_subcategory)
                        : null
                    }
                    collectionHref={opts?.iconOnlyMedia ? undefined : card.collectionHref}
                    collectionCount={opts?.iconOnlyMedia ? undefined : card.collectionCount}
                    collectionLabel={opts?.iconOnlyMedia ? undefined : card.collectionLabel}
                    isCollection={opts?.iconOnlyMedia ? false : isInlineCollection}
                    collectionExpanded={expanded}
                    onCollectionToggle={
                      isInlineCollection && !opts?.iconOnlyMedia
                        ? () => toggleSeries(seriesKey!)
                        : undefined
                    }
                    iconOnlyMedia={opts?.iconOnlyMedia}
                    isSignedIn={!!isSignedIn}
                    cartItemIds={cartItemIds}
                    addingToCart={addingToCart}
                    onAddToCart={handleAddToCart}
                    onRemoveFromCart={handleRemoveFromCart}
                    onBuy={(_, e) => openBuyModal(product, e)}
                    paidSeriesSummary={opts?.iconOnlyMedia ? undefined : paidSeriesSummary}
                    onBuySeries={
                      paidSeriesSummary && seriesKey && !opts?.iconOnlyMedia
                        ? (e) => openSeriesBuyModal(seriesKey as VaultSubcategoryId, e)
                        : undefined
                    }
                  />
                );

                if (isInlineCollection && expanded && members.length > 0) {
                  return (
                    <div
                      key={seriesKey}
                      className="col-span-full grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    >
                      {renderProductCard(card.product)}
                      {members.map((member) =>
                        renderProductCard(member, { iconOnlyMedia: true, keySuffix: "-member" })
                      )}
                    </div>
                  );
                }

                return (
                  <Fragment key={seriesKey ?? card.product.id}>
                    {renderProductCard(card.product)}
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

