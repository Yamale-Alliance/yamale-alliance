import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isMissingDbColumnError } from "@/lib/marketplace-item-db";

type MarketplaceItemRow = Pick<
  Database["public"]["Tables"]["marketplace_items"]["Row"],
  "id" | "title" | "price_cents" | "currency" | "published" | "item_pack"
>;

/** Stored on marketplace_items.item_pack (admin multi-item pack form). */
export type ItemPackConfig = {
  enabled: boolean;
  /** Display name, e.g. "Labour pack". */
  label: string;
  /** Other vault items bundled with the anchor item. */
  partner_item_ids: string[];
  pack_price_cents: number;
};

export type MarketplaceItemPackOfferItem = {
  id: string;
  title: string;
  price_cents: number;
  owned: boolean;
};

export type MarketplaceItemPackOffer = {
  anchorItemId: string;
  label: string;
  currency: string;
  itemCount: number;
  /** Sum of individual list prices in the pack. */
  totalCents: number;
  /** Admin-set whole-pack price. */
  packCents: number;
  packSavingsCents: number;
  ownedItemIds: string[];
  ownedCount: number;
  ownedCents: number;
  remainingItemIds: string[];
  remainingCount: number;
  chargeCents: number;
  fullyOwned: boolean;
  items: MarketplaceItemPackOfferItem[];
};

export function parseItemPackConfig(raw: unknown): ItemPackConfig | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.enabled) return null;
  const packPrice = Number(o.pack_price_cents);
  if (!Number.isFinite(packPrice) || packPrice <= 0) return null;
  const label = typeof o.label === "string" ? o.label.trim() : "";
  const partnerIds = Array.isArray(o.partner_item_ids)
    ? o.partner_item_ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  if (partnerIds.length === 0) return null;
  return {
    enabled: true,
    label: label || "Item pack",
    partner_item_ids: [...new Set(partnerIds.map((id) => id.trim()))],
    pack_price_cents: Math.round(packPrice),
  };
}

export function parseItemPackInput(body: unknown): ItemPackConfig | null {
  if (body == null || body === false) return null;
  if (typeof body === "object" && (body as { enabled?: boolean }).enabled === false) {
    return null;
  }
  return parseItemPackConfig(body);
}

export function buildItemPackFromForm(input: {
  enabled: boolean;
  label: string;
  pack_price_usd: number;
  partner_item_ids: string[];
}): ItemPackConfig | null {
  if (!input.enabled) return null;
  const packPrice = Math.round(input.pack_price_usd * 100);
  const partners = [...new Set(input.partner_item_ids.map((id) => id.trim()).filter(Boolean))];
  if (packPrice <= 0 || partners.length === 0) return null;
  const label = input.label.trim();
  return {
    enabled: true,
    label: label || "Item pack",
    partner_item_ids: partners,
    pack_price_cents: packPrice,
  };
}

export function itemPackToFormDefaults(raw: unknown): {
  enabled: boolean;
  label: string;
  pack_price_usd: string;
  partner_item_ids: string[];
} {
  const parsed = parseItemPackConfig(raw);
  if (parsed) {
    return {
      enabled: true,
      label: parsed.label,
      pack_price_usd: (parsed.pack_price_cents / 100).toFixed(2),
      partner_item_ids: parsed.partner_item_ids,
    };
  }
  return {
    enabled: false,
    label: "",
    pack_price_usd: "",
    partner_item_ids: [],
  };
}

function computePackChargeCents(params: {
  packCents: number;
  ownedCents: number;
  remainingListCents: number;
  remainingCount: number;
}): number {
  if (params.remainingCount === 0) return 0;
  if (params.ownedCents === 0) return params.packCents;
  return Math.max(0, params.packCents - params.ownedCents);
}

function packMemberIds(anchorId: string, cfg: ItemPackConfig): string[] {
  return [...new Set([anchorId, ...cfg.partner_item_ids])];
}

export function buildMarketplaceItemPackOffer(params: {
  anchorItemId: string;
  cfg: ItemPackConfig;
  members: MarketplaceItemRow[];
  ownedItemIds: Set<string>;
}): MarketplaceItemPackOffer | null {
  const { anchorItemId, cfg, members, ownedItemIds } = params;
  const memberIds = packMemberIds(anchorItemId, cfg);
  const byId = new Map(members.map((m) => [m.id, m]));
  const resolved = memberIds
    .map((id) => byId.get(id))
    .filter((m): m is MarketplaceItemRow => Boolean(m?.published && Number(m.price_cents) > 0));
  if (resolved.length !== memberIds.length) return null;

  const currencies = Array.from(new Set(resolved.map((m) => (m.currency || "USD").toUpperCase())));
  if (currencies.length !== 1) return null;

  const items: MarketplaceItemPackOfferItem[] = resolved.map((m) => ({
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
  const packCents = cfg.pack_price_cents;
  const packSavingsCents = packCents < totalCents ? totalCents - packCents : 0;
  const chargeCents = computePackChargeCents({
    packCents,
    ownedCents,
    remainingListCents,
    remainingCount: remaining.length,
  });

  return {
    anchorItemId,
    label: cfg.label,
    currency: currencies[0],
    itemCount: items.length,
    totalCents,
    packCents,
    packSavingsCents,
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

function partnerIdsFromPack(raw: unknown): string[] {
  const cfg = parseItemPackConfig(raw);
  return cfg?.partner_item_ids ?? [];
}

/** Find pack anchor: item owns config, or item is listed as a partner on another item. */
export function findItemPackAnchor(
  itemId: string,
  catalog: MarketplaceItemRow[]
): { anchorItemId: string; cfg: ItemPackConfig } | null {
  const self = catalog.find((r) => r.id === itemId);
  const selfCfg = self ? parseItemPackConfig(self.item_pack) : null;
  if (selfCfg) {
    return { anchorItemId: itemId, cfg: selfCfg };
  }

  for (const row of catalog) {
    if (row.id === itemId) continue;
    const cfg = parseItemPackConfig(row.item_pack);
    if (cfg && cfg.partner_item_ids.includes(itemId)) {
      return { anchorItemId: row.id, cfg };
    }
  }
  return null;
}

export async function fetchMarketplaceItemPackOffer(
  supabase: SupabaseClient<Database>,
  itemId: string,
  userId?: string | null
): Promise<MarketplaceItemPackOffer | null> {
  const { data: rows, error } = await supabase
    .from("marketplace_items")
    .select("id, title, price_cents, currency, published, item_pack")
    .eq("published", true);

  if (error) {
    if (isMissingDbColumnError(error, "item_pack")) return null;
    return null;
  }
  if (!rows?.length) return null;

  const catalog = rows as MarketplaceItemRow[];
  const anchor = findItemPackAnchor(itemId, catalog);
  if (!anchor) return null;

  const memberIds = packMemberIds(anchor.anchorItemId, anchor.cfg);
  const members = catalog.filter((r) => memberIds.includes(r.id));
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

  return buildMarketplaceItemPackOffer({
    anchorItemId: anchor.anchorItemId,
    cfg: anchor.cfg,
    members,
    ownedItemIds,
  });
}

/** Client-side pack offer from browse list when items include item_pack. */
export function computeItemPackOfferFromBrowseItems(
  itemId: string,
  members: Array<{
    id: string;
    title: string;
    price_cents: number;
    owned?: boolean;
    currency?: string;
    item_pack?: unknown;
  }>
): MarketplaceItemPackOffer | null {
  const catalog: MarketplaceItemRow[] = members.map((m) => ({
    id: m.id,
    title: m.title,
    price_cents: m.price_cents,
    currency: m.currency ?? "USD",
    published: true,
    item_pack: (m.item_pack as Record<string, unknown> | null | undefined) ?? null,
  }));

  const anchor = findItemPackAnchor(itemId, catalog);
  if (!anchor) return null;

  const memberIds = packMemberIds(anchor.anchorItemId, anchor.cfg);
  const ownedItemIds = new Set(
    members.filter((m) => memberIds.includes(m.id) && m.owned).map((m) => m.id)
  );

  return buildMarketplaceItemPackOffer({
    anchorItemId: anchor.anchorItemId,
    cfg: anchor.cfg,
    members: catalog.filter((m) => memberIds.includes(m.id)),
    ownedItemIds,
  });
}

export { partnerIdsFromPack };
