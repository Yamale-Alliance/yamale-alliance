"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MARKETPLACE_CART_UPDATED_EVENT,
  fetchMarketplaceCartSummary,
} from "@/lib/marketplace-cart-events";

export function useMarketplaceCart(isSignedIn: boolean) {
  const [count, setCount] = useState(0);
  const [itemIds, setItemIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setCount(0);
      setItemIds(new Set());
      return;
    }
    const summary = await fetchMarketplaceCartSummary();
    setCount(summary.count);
    setItemIds(summary.itemIds);
  }, [isSignedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdate = () => void refresh();
    window.addEventListener(MARKETPLACE_CART_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(MARKETPLACE_CART_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  return { count, itemIds, refresh };
}
