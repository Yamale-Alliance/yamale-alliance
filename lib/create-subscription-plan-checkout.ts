import { convertUsdCentsToMinor, getCheckoutCurrency } from "@/lib/payment-currency";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { buildLomiSubscriptionCheckoutInput } from "@/lib/lomi-catalog-checkout";

export type PlanCheckoutProvider = "lomi";

export type CreatePlanCheckoutParams = {
  userId: string;
  planId: string;
  interval: "monthly" | "annual";
  usdCents: number;
  /** Merged with base subscription metadata */
  metadataExtra: Record<string, string | undefined>;
  /** `Origin` or app URL for redirect links */
  requestOrigin: string;
  successPath?: string;
  cancelPath?: string;
};

type Ok = { ok: true; url: string; provider: PlanCheckoutProvider };
type Err = { ok: false; status: number; error: string };
type Result = Ok | Err;

const BASE_SUB_KIND = "subscription_plan";

/** Create Lomi redirect for a plan purchase (new, renewal, or upgrade with amount already resolved). */
export async function createSubscriptionPlanCheckoutRedirect(params: CreatePlanCheckoutParams): Promise<Result> {
  const { userId, planId, interval, usdCents, metadataExtra, requestOrigin } = params;
  const successPath = params.successPath ?? "/ai-research";
  const cancelPath = params.cancelPath ?? "/subscription";
  const baseMeta: Record<string, string> = {
    clerk_user_id: userId,
    plan_id: planId,
    interval,
    kind: BASE_SUB_KIND,
    payment_provider: "lomi",
  };
  for (const [k, v] of Object.entries(metadataExtra)) {
    if (v != null && v !== "") baseMeta[k] = v;
  }

  const origin = requestOrigin;
  const checkoutCurrency = getCheckoutCurrency();

  if (!isLomiConfigured()) {
    return { ok: false, status: 503, error: "Lomi checkout is not configured." };
  }
  const currencyCode = toLomiCurrency(checkoutCurrency);
  if (!currencyCode) {
    return {
      ok: false,
      status: 400,
      error: "Lomi checkout supports USD, EUR, or XOF. Set CHECKOUT_CURRENCY to one of those.",
    };
  }
  const amountCents = convertUsdCentsToMinor(usdCents, currencyCode);
  if (amountCents <= 0) {
    return { ok: false, status: 400, error: "Checkout amount must be greater than zero." };
  }
  const isProration = baseMeta.change_type === "upgrade";
  try {
    const { checkoutUrl } = await createLomiHostedCheckoutSession(
      buildLomiSubscriptionCheckoutInput({
        planId,
        interval,
        amountMinor: amountCents,
        isProration,
        currency_code: currencyCode,
        metadata: baseMeta,
        title: isProration
          ? `Upgrade to ${planId} (${interval})`
          : `${planId} plan (${interval})`,
        description: isProration
          ? `Prorated upgrade to ${String(planId).toUpperCase()}`
          : `${String(planId).toUpperCase()} ${interval} subscription`,
        success_url: `${origin}${successPath.startsWith("/") ? successPath : `/${successPath}`}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${cancelPath.startsWith("/") ? cancelPath : `/${cancelPath}`}?canceled=1`,
      })
    );
    return { ok: true, url: checkoutUrl, provider: "lomi" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lomi checkout failed";
    console.error("Lomi subscription checkout error:", err);
    return { ok: false, status: 502, error: msg };
  }
}
