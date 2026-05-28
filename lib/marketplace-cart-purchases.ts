import { getSupabaseServer } from "@/lib/supabase/server";

/** Parse `item_ids` from pawaPay (JSON array string) or Stripe metadata (comma-separated UUIDs). */
export function parseCartItemIdsMetadata(itemIdsRaw: string | undefined): string[] {
  if (!itemIdsRaw?.trim()) return [];
  const raw = itemIdsRaw.trim();
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
      }
    } catch {
      return [];
    }
    return [];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((id) => id.length > 0);
}

/** Record one marketplace purchase; bundle tier also unlocks the partner vault item when provided. */
export async function recordMarketplaceItemPurchase(params: {
  userId: string;
  marketplaceItemId: string;
  sessionId: string;
  bundlePartnerItemId?: string | null;
}): Promise<void> {
  const supabase = getSupabaseServer();
  const ids = [params.marketplaceItemId];
  const partner = params.bundlePartnerItemId?.trim();
  if (partner && partner !== params.marketplaceItemId) {
    ids.push(partner);
  }
  for (const itemId of Array.from(new Set(ids))) {
    await (supabase.from("marketplace_purchases") as any).upsert(
      {
        user_id: params.userId,
        marketplace_item_id: itemId,
        stripe_session_id: params.sessionId,
      },
      { onConflict: "user_id,marketplace_item_id" }
    );
  }
}

/** Record marketplace purchases for a cart checkout (pawaPay deposit id or Stripe Checkout session id). */
export async function recordMarketplaceCartPurchases(params: {
  userId: string;
  itemIds: string[];
  sessionId: string;
}): Promise<void> {
  const supabase = getSupabaseServer();
  const uniqueIds = Array.from(new Set(params.itemIds.filter((id) => typeof id === "string" && id.trim().length > 0)));
  for (const itemId of uniqueIds) {
    await (supabase.from("marketplace_purchases") as any).upsert(
      {
        user_id: params.userId,
        marketplace_item_id: itemId,
        stripe_session_id: params.sessionId,
      },
      { onConflict: "user_id,marketplace_item_id" }
    );
  }
}

export async function clearUserShoppingCart(userId: string): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase.from("shopping_cart_items").delete().eq("user_id", userId);
}
