"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { useClientSearchParams } from "@/lib/use-client-search-params";
import { useAlertDialog } from "@/components/ui/use-confirm";
import { isMarketplaceZip } from "@/lib/marketplace-zip-package";
import { DEFAULT_PAWAPAY_PAYMENT_COUNTRY } from "@/lib/pawapay-payment-countries";
import { useMarketplacePaymentReturn } from "@/components/marketplace/use-marketplace-payment-return";
import { notifyMarketplaceCartUpdated } from "@/lib/marketplace-cart-events";
import {
  MarketplaceVaultCheckoutDialog,
  type MarketplaceVaultCheckoutChoice,
} from "@/components/marketplace/MarketplaceVaultCheckoutDialog";
import {
  defaultCheckoutPaymentProvider,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import {
  VAULT_BROWSE_FREE,
  VAULT_BROWSE_SERIES,
  listVaultSeries,
  setVaultSeriesRegistry,
  isFreeVaultItem,
  isPaidVaultSubcategory,
  isVaultSeriesMemberItem,
  labelForVaultSubcategory,
  parseVaultSeriesParam,
  type VaultSubcategoryId,
} from "@/lib/marketplace-vault-categories";
import { vaultSeriesGroupKey, vaultSeriesPageHref } from "@/lib/marketplace-vault-series-display";
import {
  computeSeriesOfferFromBrowseItems,
  type MarketplaceSeriesOffer,
} from "@/lib/marketplace-series-offers";
import type { MarketplaceItemPackOffer } from "@/lib/marketplace-item-packs";
import { VaultLandingHero } from "@/components/marketplace/vault/VaultLandingHero";
import { VaultCategoryGrid } from "@/components/marketplace/vault/VaultCategoryGrid";
import { VaultProductSection } from "@/components/marketplace/vault/VaultProductSection";
import { VaultCatalogToolbar } from "@/components/marketplace/vault/VaultCatalogToolbar";
import { VaultProductGrid } from "@/components/marketplace/vault/VaultProductGrid";
import { buildVaultDisplayCards, isStandaloneVaultBrowseItem } from "@/lib/marketplace-vault-display-cards";
import {
  VAULT_SORT_OPTIONS,
  buildMarketplaceSearchQuery,
  parseVaultSortParam,
  sortVaultProducts,
} from "@/lib/marketplace-vault-sort";
import { canUseLawFirmAdvisoryWorkspace } from "@/lib/law-firm-advisory-preview";
import { advisoryCourseHref, isMarketplaceCourseItem } from "@/lib/marketplace-course";
import type {
  MarketplaceBrowseItem,
  MarketplaceBrowsePayload,
} from "@/lib/marketplace-browse-data";
import { writeVaultBrowseClientCache } from "@/lib/marketplace-browse-client-cache";
import type { VaultSeriesRecord } from "@/lib/marketplace-vault-series";
import { collectMarketplaceCoverPreloadUrls } from "@/lib/marketplace-cover-preload";

const LANDING_SECTION_LIMIT = 8;

type ProductCategory = "book" | "course" | "template" | "guide";

type BrowseMode =
  | { kind: "all" }
  | { kind: "type"; type: ProductCategory }
  | { kind: "free"; subcategory: string | null }
  | { kind: "series" };

// Series whose member items should only be discoverable inside their collection page.
const HIDE_MEMBER_ITEMS_FROM_CATALOG_SERIES_IDS = new Set<string>([
  "quick_investment_guide",
]);

function parseBrowseMode(categoryParam: string | null, seriesParam: string | null): BrowseMode {
  if (!categoryParam || categoryParam === "all") return { kind: "all" };
  if (categoryParam === VAULT_BROWSE_SERIES || categoryParam === "series") return { kind: "series" };
  if (categoryParam === VAULT_BROWSE_FREE) {
    const sub = parseVaultSeriesParam(seriesParam);
    return { kind: "free", subcategory: sub && !isPaidVaultSubcategory(sub) ? sub : null };
  }
  if (categoryParam === "book" || categoryParam === "course" || categoryParam === "template" || categoryParam === "guide") {
    return { kind: "type", type: categoryParam };
  }
  return { kind: "all" };
}

type Product = MarketplaceBrowseItem;

type FormatTileParam = "all" | ProductCategory | typeof VAULT_BROWSE_FREE | typeof VAULT_BROWSE_SERIES;

type TopicId = "general" | "afcftaTrade" | "tax" | "labour" | "mining" | "compliance" | "corporate";

const FORMAT_TILE_DEFS: {
  param: FormatTileParam;
  labelKey: "all" | "free" | "series" | "book" | "course" | "template" | "guide";
  icon: "all" | ProductCategory | "free" | "series";
}[] = [
  { param: "all", labelKey: "all", icon: "all" },
  { param: VAULT_BROWSE_FREE, labelKey: "free", icon: "free" },
  { param: VAULT_BROWSE_SERIES, labelKey: "series", icon: "series" },
  { param: "book", labelKey: "book", icon: "book" },
  { param: "course", labelKey: "course", icon: "course" },
  { param: "template", labelKey: "template", icon: "template" },
  { param: "guide", labelKey: "guide", icon: "guide" },
];

function inferTopicId(product: Product): TopicId {
  const text = `${product.title} ${product.description ?? ""} ${product.author}`.toLowerCase();
  if (text.includes("afcfta") || text.includes("origin") || text.includes("customs")) return "afcftaTrade";
  if (text.includes("tax") || text.includes("vat")) return "tax";
  if (text.includes("labour") || text.includes("employment")) return "labour";
  if (text.includes("mining") || text.includes("extractive")) return "mining";
  if (text.includes("compliance") || text.includes("due diligence")) return "compliance";
  if (text.includes("company") || text.includes("corporate") || text.includes("m&a")) return "corporate";
  return "general";
}

function MarketplaceGridSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden"
        >
          <div className="aspect-video w-full animate-pulse rounded bg-muted" />
          <div className="px-0.5 pt-3">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

type MarketplacePageClientProps = {
  initialPayload: MarketplaceBrowsePayload;
};

export function MarketplacePageClient({ initialPayload }: MarketplacePageClientProps) {
  const t = useTranslations("marketplace");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useClientSearchParams();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Product[]>(initialPayload.items);
  const [advisoryWorkspacePreview, setAdvisoryWorkspacePreview] = useState(
    initialPayload.advisoryWorkspacePreview
  );
  const [loading, setLoading] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [cartItemIds, setCartItemIds] = useState<Set<string>>(new Set());
  const [selectedTopic, setSelectedTopic] = useState<"all" | TopicId>("all");
  const { isSignedIn } = useAppUser();
  const [pawapayPaymentCountry, setPawapayPaymentCountry] = useState(DEFAULT_PAWAPAY_PAYMENT_COUNTRY);
  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>(
    defaultCheckoutPaymentProvider()
  );
  const [buyModalProduct, setBuyModalProduct] = useState<Product | null>(null);
  const [buyModalSeriesOffer, setBuyModalSeriesOffer] = useState<MarketplaceSeriesOffer | null>(null);
  const [buyModalPackOffer, setBuyModalPackOffer] = useState<MarketplaceItemPackOffer | null>(null);
  const [buyModalSeriesId, setBuyModalSeriesId] = useState<VaultSubcategoryId | null>(null);
  const [checkoutChoice, setCheckoutChoice] = useState<MarketplaceVaultCheckoutChoice>("item");
  const [buyCheckoutLoading, setBuyCheckoutLoading] = useState(false);
  const [expandedSeriesKey, setExpandedSeriesKey] = useState<string | null>(null);
  const [vaultSeriesList, setVaultSeriesList] = useState<VaultSeriesRecord[]>(() => {
    if (initialPayload.vaultSeries.length > 0) {
      setVaultSeriesRegistry(initialPayload.vaultSeries);
    }
    return initialPayload.vaultSeries;
  });
  const [vaultSeriesRevision, setVaultSeriesRevision] = useState(
    initialPayload.vaultSeries.length > 0 ? 1 : 0
  );
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);

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

  useEffect(() => {
    if (pendingCategory && categoryQs === pendingCategory) {
      setPendingCategory(null);
    }
  }, [categoryQs, pendingCategory]);

  const activeCategoryParam = pendingCategory ?? categoryQs;
  const browse = parseBrowseMode(activeCategoryParam, seriesQs);

  const navigateBrowseCategory = useCallback(
    (param: FormatTileParam) => {
      const category = param === "all" ? null : param;
      const qs = buildMarketplaceSearchQuery({
        category,
        series: null,
        sort: vaultSort,
      });
      setPendingCategory(category);
      setSelectedTopic("all");
      setSearch("");
      router.push(qs ? `/marketplace?${qs}` : "/marketplace", { scroll: false });
    },
    [router, vaultSort]
  );

  const marketplaceQuery = useCallback(
    (overrides?: { category?: string | null; series?: string | null; sort?: typeof vaultSort }) =>
      buildMarketplaceSearchQuery({
        category: overrides?.category !== undefined ? overrides.category : activeCategoryParam,
        series: overrides?.series !== undefined ? overrides.series : seriesQs,
        sort: overrides?.sort ?? vaultSort,
      }),
    [activeCategoryParam, seriesQs, vaultSort]
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

  const formatTiles = useMemo(
    () =>
      FORMAT_TILE_DEFS.map((tile) => ({
        ...tile,
        label: t(`formats.${tile.labelKey}`),
      })),
    [t]
  );

  const vaultSortOptions = useMemo(
    () =>
      VAULT_SORT_OPTIONS.map((opt) => ({
        value: opt.value,
        label: t(`sortOptions.${opt.value}`),
      })),
    [t]
  );

  const topicLabel = useCallback(
    (topic: "all" | TopicId) => (topic === "all" ? t("allTopics") : t(`topics.${topic}`)),
    [t]
  );

  const freeItemCount = useMemo(
    () => items.filter((p) => isFreeVaultItem(p.price_cents) && isStandaloneVaultBrowseItem(p)).length,
    [items]
  );

  const seriesCollectionCount = useMemo(() => {
    const keys = new Set<string>();
    for (const p of items) {
      const key = vaultSeriesGroupKey(p);
      if (key) keys.add(key);
    }
    return keys.size;
  }, [items]);

  const ownedCourseItem = useMemo(
    () =>
      items.find(
        (p) =>
          isMarketplaceCourseItem(p) &&
          canUseLawFirmAdvisoryWorkspace(p.owned, advisoryWorkspacePreview)
      ) ?? null,
    [items, advisoryWorkspacePreview]
  );
  const ownsLawFirmWorkspace = Boolean(ownedCourseItem) || advisoryWorkspacePreview;

  const formatTileCount = (param: FormatTileParam) => {
    if (param === "all") return items.length;
    if (param === VAULT_BROWSE_FREE) return freeItemCount;
    if (param === VAULT_BROWSE_SERIES) return seriesCollectionCount;
    return items.filter((p) => p.type === param && isStandaloneVaultBrowseItem(p)).length;
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

  const applyBrowsePayload = useCallback((payload: MarketplaceBrowsePayload) => {
    setItems(payload.items);
    setAdvisoryWorkspacePreview(payload.advisoryWorkspacePreview);
    if (payload.vaultSeries.length > 0) {
      setVaultSeriesList(payload.vaultSeries);
      setVaultSeriesRegistry(payload.vaultSeries);
      setVaultSeriesRevision((n) => n + 1);
    }
    writeVaultBrowseClientCache(payload);
  }, []);

  const refreshItems = useCallback(async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const r = await fetch(`${origin}/api/marketplace`, { credentials: "include" });
      const data = (await r.json()) as MarketplaceBrowsePayload & { items?: Product[] };
      if (!Array.isArray(data.items)) return;
      applyBrowsePayload({
        items: data.items,
        advisoryWorkspacePreview: Boolean(data.advisoryWorkspacePreview),
        vaultSeries: Array.isArray(data.vaultSeries) ? data.vaultSeries : [],
      });
    } catch {
      setItems([]);
    }
  }, [applyBrowsePayload]);

  useLayoutEffect(() => {
    if (initialPayload.vaultSeries.length > 0) {
      setVaultSeriesList(initialPayload.vaultSeries);
      setVaultSeriesRegistry(initialPayload.vaultSeries);
      setVaultSeriesRevision((n) => (n === 0 ? 1 : n));
    }
    writeVaultBrowseClientCache(initialPayload);
  }, [initialPayload]);

  useEffect(() => {
    if (items.length === 0) return;
    const urls = collectMarketplaceCoverPreloadUrls(items, vaultSeriesList, 15);
    for (const url of urls) {
      const img = new window.Image();
      img.decoding = "async";
      img.src = url;
    }
  }, [items, vaultSeriesRevision, vaultSeriesList]);

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
      const sub = p.vault_subcategory?.trim();
      const hideFromCatalog =
        sub && HIDE_MEMBER_ITEMS_FROM_CATALOG_SERIES_IDS.has(sub);
      const inSeriesBrowse = browse.kind === "series";

      // Hide certain series members from general catalog/search views.
      // They still power collection cards on the landing page and dedicated
      // series pages, but are not shown as standalone tiles in grid results.
      if (hideFromCatalog && !inSeriesBrowse) {
        return false;
      }

      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.author && p.author.toLowerCase().includes(search.toLowerCase()));
      const matchBrowse =
        browse.kind === "all"
          ? true
          : browse.kind === "series"
            ? isVaultSeriesMemberItem(p)
            : browse.kind === "type"
              ? p.type === browse.type && isStandaloneVaultBrowseItem(p)
              : isFreeVaultItem(p.price_cents) &&
                (browse.subcategory
                  ? p.vault_subcategory === browse.subcategory
                  : isStandaloneVaultBrowseItem(p));
      return matchSearch && matchBrowse;
    });
  }, [items, browse, search]);

  const topicOptions = useMemo(() => {
    const topics = new Set<TopicId>();
    for (const product of items) topics.add(inferTopicId(product));
    return ["all" as const, ...Array.from(topics).sort()];
  }, [items]);

  const filteredByTopic = useMemo(() => {
    if (selectedTopic === "all") return filtered;
    return filtered.filter((product) => inferTopicId(product) === selectedTopic);
  }, [filtered, selectedTopic]);

  const sortedProducts = useMemo(
    () => sortVaultProducts(filteredByTopic, vaultSort),
    [filteredByTopic, vaultSort]
  );

  const catalogCardMode = useMemo(() => {
    if (browse.kind === "series") return "series-only" as const;
    if (browse.kind === "type") return "standalone" as const;
    if (browse.kind === "free" && !browse.subcategory) return "standalone" as const;
    return "default" as const;
  }, [browse]);

  const { displayCards, seriesMembersByKey } = useMemo(() => {
    const freeSubcategory = browse.kind === "free" ? browse.subcategory : null;
    return buildVaultDisplayCards(
      sortedProducts,
      {
        kind:
          browse.kind === "all"
            ? "all"
            : browse.kind === "free"
              ? "free"
              : browse.kind === "series"
                ? "series"
                : "type",
        type: browse.kind === "type" ? browse.type : undefined,
        freeSubcategory,
      },
      t("seriesLabel"),
      catalogCardMode,
      vaultSeriesList
    );
  }, [browse, sortedProducts, t, catalogCardMode, vaultSeriesList]);

  const isLandingMode =
    !pendingCategory &&
    browse.kind === "all" &&
    !search.trim() &&
    selectedTopic === "all";

  const categoryGridItems = useMemo(
    () =>
      formatTiles.map((tile) => ({
        param: tile.param,
        label: tile.label,
        blurb: t(`formats.${tile.labelKey}Blurb`),
        count: formatTileCount(tile.param),
      })),
    [formatTiles, t, items, freeItemCount, seriesCollectionCount]
  );

  const landingSections = useMemo(() => {
    if (!isLandingMode) return [];

    const section = (
      titleKey: string,
      products: Product[],
      cardMode: "standalone" | "series-only",
      viewAllParam: FormatTileParam | null,
      sortOverride?: typeof vaultSort
    ) => {
      const { displayCards: cards, seriesMembersByKey: members } = buildVaultDisplayCards(
        sortVaultProducts(products, sortOverride ?? vaultSort),
        { kind: "all" },
        t("seriesLabel"),
        cardMode,
        vaultSeriesList
      );
      const qs =
        viewAllParam === null
          ? null
          : marketplaceQuery({
              category: viewAllParam === "all" ? null : viewAllParam,
              series: null,
            });
      return {
        titleKey,
        displayCards: cards.slice(0, LANDING_SECTION_LIMIT),
        seriesMembersByKey: members,
        viewAllHref: qs ? `/marketplace?${qs}` : viewAllParam === null ? undefined : "/marketplace",
      };
    };

    return [
      section(
        "landing.sectionFeatured",
        items.filter(isStandaloneVaultBrowseItem),
        "standalone",
        null,
        "recent"
      ),
      section(
        "landing.sectionSeries",
        items.filter(isVaultSeriesMemberItem),
        "series-only",
        VAULT_BROWSE_SERIES
      ),
      section(
        "landing.sectionFree",
        items.filter((p) => isFreeVaultItem(p.price_cents) && isStandaloneVaultBrowseItem(p)),
        "standalone",
        VAULT_BROWSE_FREE
      ),
      section(
        "landing.sectionCourses",
        items.filter((p) => p.type === "course" && isStandaloneVaultBrowseItem(p)),
        "standalone",
        "course"
      ),
      section(
        "landing.sectionTemplates",
        items.filter((p) => p.type === "template" && isStandaloneVaultBrowseItem(p)),
        "standalone",
        "template"
      ),
      section(
        "landing.sectionBooks",
        items.filter((p) => p.type === "book" && isStandaloneVaultBrowseItem(p)),
        "standalone",
        "book"
      ),
      section(
        "landing.sectionGuides",
        items.filter((p) => p.type === "guide" && isStandaloneVaultBrowseItem(p)),
        "standalone",
        "guide"
      ),
    ].filter((s) => s.displayCards.length > 0);
  }, [isLandingMode, items, vaultSort, marketplaceQuery, t, vaultSeriesList]);

  const browseTitle =
    browse.kind === "all"
      ? t("formats.all")
      : browse.kind === "series"
        ? t("formats.series")
        : browse.kind === "free"
          ? browse.subcategory
            ? (labelForVaultSubcategory(browse.subcategory) ?? t("formats.free"))
            : t("formats.free")
          : browse.kind === "type"
            ? (formatTiles.find((tile) => tile.param === browse.type)?.label ?? browse.type)
            : t("formats.all");

  const catalogTitle = search.trim()
    ? t("landing.searchResults")
    : browseTitle;

  const toggleSeries = useCallback((seriesKey: string) => {
    setExpandedSeriesKey((prev) => (prev === seriesKey ? null : seriesKey));
  }, []);

  useEffect(() => {
    setExpandedSeriesKey(null);
  }, [categoryQs, seriesQs]);

  useEffect(() => {
    if (pendingCategory) return;
    const seriesId = parseVaultSeriesParam(seriesQs);
    if (!seriesId) return;
    const country = searchParams.get("country");
    router.replace(vaultSeriesPageHref(seriesId, country), { scroll: true });
  }, [seriesQs, searchParams, pendingCategory, router]);

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
        await showAlert(data.error ?? t("failedAddToCart"), tCommon("cart"));
      }
    } catch {
      await showAlert(tCommon("somethingWentWrong"), tCommon("cart"));
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
        await showAlert(data.error ?? t("failedRemoveFromCart"), tCommon("cart"));
      }
    } catch {
      await showAlert(tCommon("somethingWentWrong"), tCommon("cart"));
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
      await showAlert(data.error ?? t("checkoutFailed"), tCommon("checkout"));
    } catch {
      await showAlert(tCommon("somethingWentWrong"), tCommon("checkout"));
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
      {isLandingMode ? (
        <VaultLandingHero
          search={search}
          onSearchChange={setSearch}
          isSignedIn={!!isSignedIn}
          cartCount={cartCount}
          ownsLawFirmWorkspace={ownsLawFirmWorkspace}
          totalResources={items.length}
          freeResources={freeItemCount}
          seriesCount={seriesCollectionCount}
          advisoryCourseHref={
            ownedCourseItem
              ? advisoryCourseHref(ownedCourseItem)
              : ownsLawFirmWorkspace
                ? "/advisory"
                : undefined
          }
        />
      ) : null}
      {(paymentVerifyInProgress || showVerifiedPaymentSuccess) && (
        <div className="border-b border-border bg-card px-4 py-3">
          <div className="mx-auto max-w-7xl text-sm">
            {paymentVerifyInProgress && (
              <p className="text-muted-foreground">{t("confirmingPayment")}</p>
            )}
            {showVerifiedPaymentSuccess && !paymentVerifyInProgress && (
              <p className="font-medium text-green-700 dark:text-green-400">
                {t("paymentSuccess")}
              </p>
            )}
          </div>
        </div>
      )}

      {isLandingMode ? (
        <>
          <VaultCategoryGrid
            categories={categoryGridItems}
            onSelectCategory={navigateBrowseCategory}
          />
          {loading ? (
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
              <MarketplaceGridSkeleton />
            </div>
          ) : (
            landingSections.map((section, index) => (
              <VaultProductSection
                key={section.titleKey}
                title={t(section.titleKey)}
                viewAllHref={section.viewAllHref}
                displayCards={section.displayCards}
                seriesMembersByKey={section.seriesMembersByKey}
                expandedSeriesKey={expandedSeriesKey}
                onToggleSeries={toggleSeries}
                layout="rail"
                muted={index % 2 === 1}
                variant={section.titleKey === "landing.sectionSeries" ? "series" : "default"}
                isSignedIn={!!isSignedIn}
                cartItemIds={cartItemIds}
                addingToCart={addingToCart}
                advisoryWorkspacePreview={advisoryWorkspacePreview}
                onAddToCart={handleAddToCart}
                onRemoveFromCart={handleRemoveFromCart}
                onBuy={(product, e) => openBuyModal(product as Product, e)}
                onBuySeries={openSeriesBuyModal}
              />
            ))
          )}
        </>
      ) : (
        <>
          <VaultCatalogToolbar
            title={catalogTitle}
            resultCount={displayCards.length}
            search={search}
            onSearchChange={setSearch}
            vaultSort={vaultSort}
            onSortChange={(sort) => setVaultSort(sort as typeof vaultSort)}
            sortOptions={vaultSortOptions}
            selectedTopic={selectedTopic}
            onTopicChange={setSelectedTopic}
            topicOptions={topicOptions}
            topicLabel={topicLabel}
            clearHref="/marketplace"
            showFreeSeries={browse.kind === "free"}
            allFreeHref={`/marketplace?${marketplaceQuery({ category: "free", series: null })}`}
            allFreeActive={browse.kind === "free" && !browse.subcategory}
            allFreeCount={freeItemCount}
            freeSeriesLinks={listVaultSeries()
              .filter((s) => !s.paid)
              .map((series) => ({
                id: series.id,
                label: series.label,
                href: vaultSeriesPageHref(series.id),
                active: browse.kind === "free" && browse.subcategory === series.id,
                count: freeSeriesCounts.get(series.id) ?? 0,
              }))}
          />
          <section className="pb-16 pt-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {loading ? (
                <MarketplaceGridSkeleton />
              ) : displayCards.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-border bg-card px-8 py-12 text-center">
                  <h3 className="text-xl font-semibold text-foreground">{t("emptyTitle")}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{t("emptyHint")}</p>
                </div>
              ) : (
                <VaultProductGrid
                  displayCards={displayCards}
                  seriesMembersByKey={seriesMembersByKey}
                  expandedSeriesKey={expandedSeriesKey}
                  onToggleSeries={toggleSeries}
                  layout="grid"
                  isSignedIn={!!isSignedIn}
                  cartItemIds={cartItemIds}
                  addingToCart={addingToCart}
                  advisoryWorkspacePreview={advisoryWorkspacePreview}
                  onAddToCart={handleAddToCart}
                  onRemoveFromCart={handleRemoveFromCart}
                  onBuy={(product, e) => openBuyModal(product as Product, e)}
                  onBuySeries={openSeriesBuyModal}
                />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

