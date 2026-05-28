import type { HostedLomiCheckoutInput } from "@/lib/lomi-checkout";
import {
  getLomiCatalogPriceId,
  getLomiSubscriptionPriceId,
  type LomiCatalogOneTimeKey,
  type LomiSubscriptionInterval,
} from "@/lib/lomi-catalog-prices";

/**
 * Build Lomi session input: use catalog `price_id` when configured, else `amount`.
 * For subscriptions, omit `amount` on full-price checkout; include it for proration upgrades.
 */
export function buildLomiCatalogCheckoutInput(params: {
  currency_code: HostedLomiCheckoutInput["currency_code"];
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
  title?: string;
  description?: string;
  /** Minor units — always required as fallback; also sent with price_id when `includeAmountWithPriceId`. */
  amountMinor: number;
  price_id?: string | null;
  quantity?: number;
  /** When true, send `amount` together with `price_id` (proration, multi-seat totals). */
  includeAmountWithPriceId?: boolean;
}): HostedLomiCheckoutInput {
  const priceId = params.price_id?.trim() || null;
  const input: HostedLomiCheckoutInput = {
    currency_code: params.currency_code,
    success_url: params.success_url,
    cancel_url: params.cancel_url,
    metadata: params.metadata,
    title: params.title,
    description: params.description,
  };
  if (priceId) {
    input.price_id = priceId;
    if (params.quantity != null && params.quantity > 1) {
      input.quantity = params.quantity;
    }
    if (params.includeAmountWithPriceId) {
      input.amount = params.amountMinor;
    }
  } else {
    input.amount = params.amountMinor;
  }
  return input;
}

export function buildLomiSubscriptionCheckoutInput(params: {
  planId: string;
  interval: LomiSubscriptionInterval;
  amountMinor: number;
  isProration: boolean;
  currency_code: HostedLomiCheckoutInput["currency_code"];
  success_url: string;
  cancel_url: string;
  metadata: Record<string, string>;
  title?: string;
  description?: string;
}): HostedLomiCheckoutInput {
  const priceId = getLomiSubscriptionPriceId(params.planId, params.interval);
  return buildLomiCatalogCheckoutInput({
    currency_code: params.currency_code,
    success_url: params.success_url,
    cancel_url: params.cancel_url,
    metadata: params.metadata,
    title: params.title,
    description: params.description,
    amountMinor: params.amountMinor,
    price_id: priceId,
    includeAmountWithPriceId: params.isProration,
  });
}

export function buildLomiOneTimeCatalogCheckoutInput(params: {
  catalogKey: LomiCatalogOneTimeKey;
  amountMinor: number;
  currency_code: HostedLomiCheckoutInput["currency_code"];
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
  title?: string;
  description?: string;
  quantity?: number;
}): HostedLomiCheckoutInput {
  const priceId = getLomiCatalogPriceId(params.catalogKey);
  const multiQty = (params.quantity ?? 1) > 1;
  return buildLomiCatalogCheckoutInput({
    currency_code: params.currency_code,
    success_url: params.success_url,
    cancel_url: params.cancel_url,
    metadata: params.metadata,
    title: params.title,
    description: params.description,
    amountMinor: params.amountMinor,
    price_id: priceId,
    quantity: params.quantity,
    includeAmountWithPriceId: multiQty,
  });
}
