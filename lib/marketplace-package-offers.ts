/** Dual-tier ZIP package checkout (standalone vs bundle with another vault item). */

export type PackageOfferTier = "standalone" | "bundle";

export type ResolvedPackageOfferItem = {
  id: string;
  title: string;
  price_cents: number;
  currency: string;
};

export type PackageOffersResolved = {
  standalone: ResolvedPackageOfferItem;
  bundle: {
    /** Line item charged at checkout (kit add-on only). */
    items: ResolvedPackageOfferItem[];
    /** Partner vault item shown for context — not added to checkout total. */
    partner?: ResolvedPackageOfferItem;
    total_cents: number;
    label: string;
    note: string;
  };
};

export type PackageOffersConfig = {
  standaloneItemId?: string;
  bundleAddonItemId?: string;
  bundleWithItemId?: string;
};

/** Stored on marketplace_items.package_offers (admin dual-pricing form). */
export type ItemPackageOffers = {
  enabled: boolean;
  standalone_price_cents: number;
  bundle_addon_price_cents: number;
  bundle_with_item_id: string | null;
};

export function parseItemPackageOffers(raw: unknown): ItemPackageOffers | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.enabled) return null;
  const standalone = Number(o.standalone_price_cents);
  const bundleAddon = Number(o.bundle_addon_price_cents);
  if (!Number.isFinite(standalone) || standalone <= 0) return null;
  if (!Number.isFinite(bundleAddon) || bundleAddon < 0) return null;
  const bundleWith =
    typeof o.bundle_with_item_id === "string" && o.bundle_with_item_id.trim()
      ? o.bundle_with_item_id.trim()
      : null;
  return {
    enabled: true,
    standalone_price_cents: Math.round(standalone),
    bundle_addon_price_cents: Math.round(bundleAddon),
    bundle_with_item_id: bundleWith,
  };
}

export function parseItemPackageOffersInput(body: unknown): ItemPackageOffers | null {
  if (body == null || body === false) return null;
  if (typeof body === "object" && (body as { enabled?: boolean }).enabled === false) {
    return null;
  }
  return parseItemPackageOffers(body);
}

/** Build JSON for API from admin form values (USD). */
export function buildItemPackageOffersFromForm(input: {
  enabled: boolean;
  standalone_price_usd: number;
  bundle_addon_price_usd: number;
  bundle_with_item_id: string | null;
}): ItemPackageOffers | null {
  if (!input.enabled) return null;
  const standalone = Math.round(input.standalone_price_usd * 100);
  const bundleAddon = Math.round(input.bundle_addon_price_usd * 100);
  if (standalone <= 0) return null;
  if (bundleAddon < 0) return null;
  return {
    enabled: true,
    standalone_price_cents: standalone,
    bundle_addon_price_cents: bundleAddon,
    bundle_with_item_id: input.bundle_with_item_id?.trim() || null,
  };
}

export function itemPackageOffersToFormDefaults(
  raw: unknown,
  fallbackPriceCents: number
): {
  enabled: boolean;
  standalone_price_usd: string;
  bundle_addon_price_usd: string;
  bundle_with_item_id: string;
} {
  const parsed = parseItemPackageOffers(raw);
  if (parsed) {
    return {
      enabled: true,
      standalone_price_usd: (parsed.standalone_price_cents / 100).toFixed(2),
      bundle_addon_price_usd: (parsed.bundle_addon_price_cents / 100).toFixed(2),
      bundle_with_item_id: parsed.bundle_with_item_id ?? "",
    };
  }
  const fallbackUsd = (fallbackPriceCents / 100).toFixed(2);
  return {
    enabled: false,
    standalone_price_usd: "199.00",
    bundle_addon_price_usd: fallbackUsd,
    bundle_with_item_id: "",
  };
}

/** Standalone checkout amount for a page item (override when dual pricing is enabled). */
export function standaloneCheckoutPriceCents(
  pageItem: MarketplaceItemRow & { package_offers?: unknown }
): number {
  const cfg = parseItemPackageOffers(pageItem.package_offers);
  if (cfg) return cfg.standalone_price_cents;
  return pageItem.price_cents;
}

/** Bundle-tier checkout: discounted kit add-on (not partner vault price + add-on). */
export function bundleAddonCheckoutPriceCents(
  pageItem: MarketplaceItemRow & { package_offers?: unknown }
): number | null {
  const cfg = parseItemPackageOffers(pageItem.package_offers);
  if (!cfg) return null;
  return cfg.bundle_addon_price_cents;
}

/** Checkout/display offers from admin package_offers on the page item (no catalog required). */
export function packageOffersFromItemConfig(
  pageItemId: string,
  pageItem: MarketplaceItemRow & { package_offers?: unknown }
): PackageOffersResolved | null {
  const cfg = parseItemPackageOffers(pageItem.package_offers);
  if (!cfg) return null;

  const currency = (pageItem.currency || "USD").toUpperCase();
  const saveCents = Math.max(0, cfg.standalone_price_cents - cfg.bundle_addon_price_cents);

  return {
    standalone: {
      id: pageItemId,
      title: pageItem.title,
      price_cents: cfg.standalone_price_cents,
      currency,
    },
    bundle: {
      items: [
        {
          id: pageItemId,
          title: pageItem.title,
          price_cents: cfg.bundle_addon_price_cents,
          currency,
        },
      ],
      total_cents: cfg.bundle_addon_price_cents,
      label: "Bundle add-on (with Law Firm Package)",
      note: `Kit add-on ${formatUsd(cfg.bundle_addon_price_cents)}${saveCents > 0 ? ` — save ${formatUsd(saveCents)} vs standalone ${formatUsd(cfg.standalone_price_cents)}` : ""}. Law Firm package sold separately in the Vault if needed.`,
    },
  };
}

/** Parse $199 / $129 style amounts from admin landing HTML (when package_offers is not saved yet). */
export function parseDualUsdCentsFromLandingHtml(
  html: string | null | undefined
): { standaloneCents: number; bundleCents: number } | null {
  if (!html?.trim()) return null;

  const usdToCents = (raw: string) => {
    const n = parseFloat(raw.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100);
  };

  const firstUsdInBlock = (block: string | undefined): number | null => {
    if (!block) return null;
    const m = block.match(/\$\s*(\d+(?:[.,]\d{2})?)/);
    return m ? usdToCents(m[1].replace(",", ".")) : null;
  };

  const standardBlock = html.match(
    /class=["'][^"']*pricing-card[^"']*\bstandard\b[^"']*["'][\s\S]{0,5000}/i
  )?.[0];
  const bundleBlock = html.match(
    /class=["'][^"']*pricing-card[^"']*\bbundle\b[^"']*["'][\s\S]{0,5000}/i
  )?.[0];

  let standaloneCents = firstUsdInBlock(standardBlock);
  let bundleCents = firstUsdInBlock(bundleBlock);

  if (standaloneCents == null || bundleCents == null) {
    const pricingSlice =
      html.match(/class=["'][^"']*pricing-section[^"']*["'][\s\S]{0,16000}/i)?.[0] ??
      html.match(/id=["']pricing["'][\s\S]{0,16000}/i)?.[0] ??
      html;
    const amounts = [
      ...pricingSlice.matchAll(/\$\s*(\d+(?:[.,]\d{2})?)/g),
    ]
      .map((m) => usdToCents(m[1].replace(",", ".")))
      .filter((c): c is number => c != null);
    const uniq = [...new Set(amounts)].sort((a, b) => b - a);
    if (uniq.length >= 2) {
      standaloneCents = standaloneCents ?? uniq[0];
      bundleCents = bundleCents ?? uniq.find((c) => c < (standaloneCents ?? 0)) ?? uniq[1];
    }
  }

  if (standaloneCents == null || bundleCents == null || standaloneCents <= 0 || bundleCents < 0) {
    return null;
  }
  return { standaloneCents, bundleCents };
}

/** Resolved offers from landing-page pricing cards ($199 standalone + $129 bundle). */
export function packageOffersFromLandingHtml(
  pageItemId: string,
  pageItem: { title: string; currency?: string | null },
  html: string | null | undefined
): PackageOffersResolved | null {
  const prices = parseDualUsdCentsFromLandingHtml(html);
  if (!prices) return null;

  const currency = (pageItem.currency || "USD").toUpperCase();
  const saveCents = Math.max(0, prices.standaloneCents - prices.bundleCents);

  return {
    standalone: {
      id: pageItemId,
      title: pageItem.title,
      price_cents: prices.standaloneCents,
      currency,
    },
    bundle: {
      items: [
        {
          id: pageItemId,
          title: pageItem.title,
          price_cents: prices.bundleCents,
          currency,
        },
      ],
      total_cents: prices.bundleCents,
      label: "Bundle add-on (with Law Firm Package)",
      note:
        saveCents > 0
          ? `Kit add-on ${formatUsd(prices.bundleCents)} — save ${formatUsd(saveCents)} vs standalone ${formatUsd(prices.standaloneCents)}. Law Firm package sold separately in the Vault if needed.`
          : `Kit add-on ${formatUsd(prices.bundleCents)}. Law Firm package sold separately in the Vault if needed.`,
    },
  };
}

export function resolvePackageOffersForPageItem(
  pageItemId: string,
  pageItem: MarketplaceItemRow & { package_offers?: unknown; landing_page_html?: string | null },
  catalog: MarketplaceItemRow[],
  externalConfig: PackageOffersConfig | null
): PackageOffersResolved | null {
  return (
    resolvePackageOffers(pageItemId, pageItem, catalog, externalConfig) ??
    packageOffersFromItemConfig(pageItemId, pageItem) ??
    packageOffersFromLandingHtml(pageItemId, pageItem, pageItem.landing_page_html)
  );
}

export function checkoutPriceCentsForTier(
  pageItem: MarketplaceItemRow & { package_offers?: unknown; landing_page_html?: string | null },
  tier: PackageOfferTier
): number {
  const resolved =
    packageOffersFromItemConfig(pageItem.id, pageItem) ??
    packageOffersFromLandingHtml(pageItem.id, pageItem, pageItem.landing_page_html);
  if (resolved) {
    return tier === "bundle" ? resolved.bundle.total_cents : resolved.standalone.price_cents;
  }

  if (tier === "bundle") {
    const bundle = bundleAddonCheckoutPriceCents(pageItem);
    if (bundle != null) return bundle;
  }
  return standaloneCheckoutPriceCents(pageItem);
}

const META_NAME = "yamale-package-offers";

/** Parse optional `<meta name="yamale-package-offers" content='{...}'>` from admin landing HTML. */
export function parsePackageOffersConfigFromLandingHtml(html: string | null | undefined): PackageOffersConfig | null {
  if (!html?.trim()) return null;
  const metaMatch = html.match(
    new RegExp(
      `<meta[^>]+name=["']${META_NAME}["'][^>]+content=["']([^"']+)["']`,
      "i"
    )
  );
  const metaMatchAlt = metaMatch
    ? null
    : html.match(
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${META_NAME}["']`,
          "i"
        )
      );
  const raw = (metaMatch?.[1] ?? metaMatchAlt?.[1])?.trim();
  if (!raw) return null;
  try {
    const decoded = raw.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const parsed = JSON.parse(decoded) as PackageOffersConfig;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parsePackageOffersEnvForPage(pageItemId: string): PackageOffersConfig | null {
  const raw = process.env.MARKETPLACE_PACKAGE_OFFERS_JSON?.trim();
  if (!raw) return null;
  try {
    const map = JSON.parse(raw) as Record<string, PackageOffersConfig>;
    const cfg = map[pageItemId];
    return cfg && typeof cfg === "object" ? cfg : null;
  } catch {
    return null;
  }
}

type MarketplaceItemRow = {
  id: string;
  title: string;
  price_cents: number;
  currency: string | null;
  published: boolean;
};

function titleLooksLikeZmsKit(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.includes("mining") ||
    t.includes("subcontractor") ||
    t.includes("extractive") ||
    t.includes("zms")
  );
}

function titleLooksLikeLawFirmPackage(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("law firm") && (t.includes("development") || t.includes("package"));
}

/**
 * Resolve standalone ($199) + bundle ($499 + $129) item ids from config or published vault items.
 */
export function resolvePackageOffersFromCatalog(
  pageItemId: string,
  pageItem: MarketplaceItemRow,
  catalog: MarketplaceItemRow[],
  config: PackageOffersConfig | null
): PackageOffersResolved | null {
  const byId = new Map(catalog.map((r) => [r.id, r]));

  const pick = (id: string | undefined, fallback: () => MarketplaceItemRow | undefined) => {
    if (id && byId.has(id)) return byId.get(id)!;
    return fallback();
  };

  const standalone = pick(config?.standaloneItemId, () =>
    catalog.find((r) => r.price_cents === 19900 && titleLooksLikeZmsKit(r.title))
  );
  const bundleAddon = pick(config?.bundleAddonItemId, () =>
    catalog.find((r) => r.id === pageItemId && r.price_cents === 12900) ??
      catalog.find((r) => r.price_cents === 12900 && titleLooksLikeZmsKit(r.title))
  );
  const bundleWith = pick(config?.bundleWithItemId, () =>
    catalog.find((r) => r.price_cents === 49900 && titleLooksLikeLawFirmPackage(r.title))
  );

  if (!standalone || !bundleAddon || !bundleWith) return null;

  const addonCents = bundleAddon.price_cents;
  const standaloneCents = standalone.price_cents;

  return {
    standalone: {
      id: standalone.id,
      title: standalone.title,
      price_cents: standaloneCents,
      currency: (standalone.currency || "USD").toUpperCase(),
    },
    bundle: {
      items: [
        {
          id: bundleAddon.id,
          title: bundleAddon.title,
          price_cents: addonCents,
          currency: (bundleAddon.currency || "USD").toUpperCase(),
        },
      ],
      partner: {
        id: bundleWith.id,
        title: bundleWith.title,
        price_cents: bundleWith.price_cents,
        currency: (bundleWith.currency || "USD").toUpperCase(),
      },
      total_cents: addonCents,
      label: "Bundle add-on (with Law Firm Package)",
      note: `Kit add-on ${formatUsd(addonCents)} (save ${formatUsd(Math.max(0, standaloneCents - addonCents))} vs ${formatUsd(standaloneCents)} standalone). Requires ${bundleWith.title} — purchase it separately in the Vault if you do not already own it.`,
    },
  };
}

function resolveFromItemPackageOffers(
  pageItemId: string,
  pageItem: MarketplaceItemRow & { package_offers?: unknown },
  catalog: MarketplaceItemRow[]
): PackageOffersResolved | null {
  const cfg = parseItemPackageOffers(pageItem.package_offers);
  if (!cfg) return null;

  const currency = (pageItem.currency || "USD").toUpperCase();
  const bundleWith = cfg.bundle_with_item_id
    ? catalog.find((r) => r.id === cfg.bundle_with_item_id && r.published)
    : catalog.find((r) => r.published && titleLooksLikeLawFirmPackage(r.title));

  if (!bundleWith) return null;

  const addonLine: ResolvedPackageOfferItem = {
    id: pageItemId,
    title: pageItem.title,
    price_cents: cfg.bundle_addon_price_cents,
    currency,
  };

  const saveCents = Math.max(0, cfg.standalone_price_cents - cfg.bundle_addon_price_cents);

  return {
    standalone: {
      id: pageItemId,
      title: pageItem.title,
      price_cents: cfg.standalone_price_cents,
      currency,
    },
    bundle: {
      items: [addonLine],
      partner: {
        id: bundleWith.id,
        title: bundleWith.title,
        price_cents: bundleWith.price_cents,
        currency: (bundleWith.currency || currency).toUpperCase(),
      },
      total_cents: cfg.bundle_addon_price_cents,
      label: "Bundle add-on (with Law Firm Package)",
      note: `Kit add-on ${formatUsd(cfg.bundle_addon_price_cents)}${saveCents > 0 ? ` — save ${formatUsd(saveCents)} vs standalone ${formatUsd(cfg.standalone_price_cents)}` : ""}. Pair with ${bundleWith.title} (${formatUsd(bundleWith.price_cents)} in the Vault if you need it).`,
    },
  };
}

/**
 * Resolve dual-tier offers: admin package_offers on the item first, then meta/env/catalog heuristics.
 */
export function resolvePackageOffers(
  pageItemId: string,
  pageItem: MarketplaceItemRow & { package_offers?: unknown },
  catalog: MarketplaceItemRow[],
  externalConfig: PackageOffersConfig | null
): PackageOffersResolved | null {
  const fromItem = resolveFromItemPackageOffers(pageItemId, pageItem, catalog);
  if (fromItem) return fromItem;
  return resolvePackageOffersFromCatalog(pageItemId, pageItem, catalog, externalConfig);
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
