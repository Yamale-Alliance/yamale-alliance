import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  isPaidVaultSubcategory,
  isValidVaultSubcategory,
  labelForVaultSubcategory,
  seriesBundlePriceCents,
  type VaultSubcategoryId,
} from "@/lib/marketplace-vault-categories";

type MarketplaceItemRow = Pick<
  Database["public"]["Tables"]["marketplace_items"]["Row"],
  "id" | "title" | "price_cents" | "currency" | "published" | "vault_subcategory" | "sort_order"
>;

export type MarketplaceSeriesOfferItem = {
  id: string;
  title: string;
  price_cents: number;
  owned: boolean;
};

export type MarketplaceSeriesOffer = {
  seriesId: VaultSubcategoryId;
  label: string;
  currency: string;
  itemCount: number;
  /** Sum of individual item list prices. */
  totalCents: number;
  /** Whole-series bundle price when configured (e.g. $79). */
  bundleCents: number | null;
  /** List total minus bundle price when a bundle discount applies. */
  bundleSavingsCents: number;
  ownedItemIds: string[];
  ownedCount: number;
  ownedCents: number;
  remainingItemIds: string[];
  remainingCount: number;
  /** Amount charged for completing the series (bundle price, prorated if partially owned). */
  chargeCents: number;
  fullyOwned: boolean;
  items: MarketplaceSeriesOfferItem[];
};

function computeSeriesChargeCents(params: {
  bundleCents: number | null;
  totalCents: number;
  ownedCents: number;
  remainingListCents: number;
  remainingCount: number;
}): number {
  if (params.remainingCount === 0) return 0;
  if (params.bundleCents != null && params.bundleCents > 0) {
    if (params.ownedCents === 0) return params.bundleCents;
    return Math.max(0, params.bundleCents - params.ownedCents);
  }
  return params.remainingListCents;
}

export function buildMarketplaceSeriesOffer(params: {
  seriesId: VaultSubcategoryId;
  members: MarketplaceItemRow[];
  ownedItemIds: Set<string>;
}): MarketplaceSeriesOffer | null {
  const { seriesId, members, ownedItemIds } = params;
  const publishedMembers = members.filter(
    (m) => m.published && m.vault_subcategory?.trim() === seriesId && Number(m.price_cents) > 0
  );
  if (publishedMembers.length === 0) return null;

  const currencies = Array.from(
    new Set(publishedMembers.map((m) => (m.currency || "USD").toUpperCase()))
  );
  if (currencies.length !== 1) return null;

  const sorted = [...publishedMembers].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.title.localeCompare(b.title)
  );

  const items: MarketplaceSeriesOfferItem[] = sorted.map((m) => ({
    id: m.id,
    title: m.title,
    price_cents: Number(m.price_cents) || 0,
    owned: ownedItemIds.has(m.id),
  }));

  const owned = items.filter((i) => i.owned);
  const remaining = items.filter((i) => !i.owned);
  const totalCents = items.reduce((sum, i) => sum + i.price_cents, 0);
  const ownedCents = owned.reduce((sum, i) => sum + i.price_cents, 0);
  const remainingListCents = remaining.reduce((sum, i) => sum + i.price_cents, 0);
  const bundleCents = seriesBundlePriceCents(seriesId);
  const bundleSavingsCents =
    bundleCents != null && bundleCents > 0 && bundleCents < totalCents ? totalCents - bundleCents : 0;
  const chargeCents = computeSeriesChargeCents({
    bundleCents,
    totalCents,
    ownedCents,
    remainingListCents,
    remainingCount: remaining.length,
  });

  return {
    seriesId,
    label: labelForVaultSubcategory(seriesId) ?? seriesId,
    currency: currencies[0],
    itemCount: items.length,
    totalCents,
    bundleCents,
    bundleSavingsCents,
    ownedItemIds: owned.map((i) => i.id),
    ownedCount: owned.length,
    ownedCents,
    remainingItemIds: remaining.map((i) => i.id),
    remainingCount: remaining.length,
    chargeCents,
    fullyOwned: remaining.length === 0,
    items,
  };
}

export async function fetchMarketplaceSeriesOffer(
  supabase: SupabaseClient<Database>,
  seriesId: string,
  userId?: string | null
): Promise<MarketplaceSeriesOffer | null> {
  if (!isValidVaultSubcategory(seriesId) || !isPaidVaultSubcategory(seriesId)) {
    return null;
  }

  const { data: memberRows, error } = await supabase
    .from("marketplace_items")
    .select("id, title, price_cents, currency, published, vault_subcategory, sort_order")
    .eq("published", true)
    .eq("vault_subcategory", seriesId)
    .gt("price_cents", 0)
    .order("sort_order", { ascending: true });

  if (error || !memberRows?.length) return null;

  const members = memberRows as MarketplaceItemRow[];
  const memberIds = members.map((m) => m.id);
  const ownedItemIds = new Set<string>();

  if (userId && memberIds.length > 0) {
    const { data: purchases } = await supabase
      .from("marketplace_purchases")
      .select("marketplace_item_id")
      .eq("user_id", userId)
      .in("marketplace_item_id", memberIds);
    for (const row of purchases ?? []) {
      const id = (row as { marketplace_item_id: string }).marketplace_item_id;
      if (id) ownedItemIds.add(id);
    }
  }

  return buildMarketplaceSeriesOffer({ seriesId, members, ownedItemIds });
}

/** Client-side offer from browse list items that already include `owned`. */
export function computeSeriesOfferFromBrowseItems(
  seriesId: VaultSubcategoryId,
  members: Array<{ id: string; title: string; price_cents: number; owned?: boolean; currency?: string }>
): MarketplaceSeriesOffer | null {
  const paidMembers = members.filter((m) => Number(m.price_cents) > 0);
  if (paidMembers.length === 0) return null;

  const ownedItemIds = new Set(paidMembers.filter((m) => m.owned).map((m) => m.id));
  return buildMarketplaceSeriesOffer({
    seriesId,
    members: paidMembers.map((m) => ({
      id: m.id,
      title: m.title,
      price_cents: m.price_cents,
      currency: m.currency ?? "USD",
      published: true,
      vault_subcategory: seriesId,
      sort_order: 0,
    })),
    ownedItemIds,
  });
}
