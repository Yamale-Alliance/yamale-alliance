/** Fired when shopping cart rows change (add, remove, checkout, payment confirmed). */
export const MARKETPLACE_CART_UPDATED_EVENT = "yamale-marketplace-cart-updated";

export function notifyMarketplaceCartUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MARKETPLACE_CART_UPDATED_EVENT));
}

export type MarketplaceCartSummary = {
  count: number;
  itemIds: Set<string>;
};

export async function fetchMarketplaceCartSummary(): Promise<MarketplaceCartSummary> {
  const empty: MarketplaceCartSummary = { count: 0, itemIds: new Set() };
  try {
    const r = await fetch("/api/cart", { credentials: "include" });
    if (!r.ok) return empty;
    const data = (await r.json()) as {
      cart?: Array<{ marketplace_item_id: string; quantity: number }>;
    };
    const cart = data.cart ?? [];
    return {
      count: cart.reduce((sum, item) => sum + (item.quantity || 1), 0),
      itemIds: new Set(cart.map((item) => item.marketplace_item_id)),
    };
  } catch {
    return empty;
  }
}
