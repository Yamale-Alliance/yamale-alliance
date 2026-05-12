import {
  convertUsdCentsToPawapayMinor,
  createPaymentPageSession,
  isPawapayConfigured,
  isPawapayLiveApi,
  resolvePawapayReturnOrigin,
} from "@/lib/pawapay";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { requirePawapayPaymentCountry } from "@/lib/pawapay-require-payment-country";

export type PlanCheckoutProvider = "pawapay" | "lomi";

export type CreatePlanCheckoutParams = {
  userId: string;
  planId: string;
  interval: "monthly" | "annual";
  usdCents: number;
  /** Merged with base subscription metadata */
  metadataExtra: Record<string, string | undefined>;
  /** `Origin` or app URL for redirect links */
  requestOrigin: string;
  provider: PlanCheckoutProvider;
  /** Original POST body (country selection for pawaPay) */
  pawapayBody: Record<string, unknown>;
  successPath?: string;
  cancelPath?: string;
};

type Ok = { ok: true; url: string; provider: PlanCheckoutProvider };
type Err = { ok: false; status: number; error: string };
type Result = Ok | Err;

const BASE_SUB_KIND = "subscription_plan";

/**
 * Create pawaPay or Lomi redirect for a plan purchase (new, renewal, or upgrade with amount already resolved).
 */
export async function createSubscriptionPlanCheckoutRedirect(params: CreatePlanCheckoutParams): Promise<Result> {
  const { userId, planId, interval, usdCents, metadataExtra, requestOrigin, provider, pawapayBody } = params;
  const successPath = params.successPath ?? "/dashboard";
  const cancelPath = params.cancelPath ?? "/subscription";
  const baseMeta: Record<string, string> = {
    clerk_user_id: userId,
    plan_id: planId,
    interval,
    kind: BASE_SUB_KIND,
    payment_provider: provider,
  };
  for (const [k, v] of Object.entries(metadataExtra)) {
    if (v != null && v !== "") baseMeta[k] = v;
  }

  const origin = requestOrigin;
  const pawCurrency = (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase();

  if (provider === "lomi") {
    if (!isLomiConfigured()) {
      return { ok: false, status: 503, error: "Lomi card checkout is not configured." };
    }
    const currencyCode = toLomiCurrency(pawCurrency);
    if (!currencyCode) {
      return {
        ok: false,
        status: 400,
        error:
          "Lomi checkout supports USD, EUR, or XOF. Set PAWAPAY_CURRENCY to one of those (or use mobile money).",
      };
    }
    const amountCents = convertUsdCentsToPawapayMinor(usdCents, currencyCode);
    const { checkoutUrl } = await createLomiHostedCheckoutSession({
      amount: amountCents,
      currency_code: currencyCode,
      metadata: baseMeta,
      title: `${planId} plan (${interval})`,
      description: `${String(planId).toUpperCase()} ${interval} subscription`,
      success_url: `${origin}${successPath.startsWith("/") ? successPath : `/${successPath}`}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${cancelPath.startsWith("/") ? cancelPath : `/${cancelPath}`}?canceled=1`,
    });
    return { ok: true, url: checkoutUrl, provider: "lomi" };
  }

  if (!isPawapayConfigured()) {
    return { ok: false, status: 503, error: "PawaPay mobile money is not configured." };
  }
  const gate = requirePawapayPaymentCountry(pawapayBody);
  if (!gate.ok) return { ok: false, status: 400, error: "Select a mobile money country to continue." };

  const returnBase = resolvePawapayReturnOrigin(requestOrigin);
  if (isPawapayLiveApi() && !/^https:\/\//i.test(returnBase)) {
    return {
      ok: false,
      status: 400,
      error:
        "pawaPay live requires an HTTPS return URL. Set PAWAPAY_RETURN_BASE_URL to your public app URL (for example, https://yamale-alliance.vercel.app).",
    };
  }

  const amountCents = convertUsdCentsToPawapayMinor(usdCents, gate.country.currency);
  const depositId = crypto.randomUUID();
  const returnUrl = `${returnBase}${successPath.startsWith("/") ? successPath : `/${successPath}`}?checkout=success&session_id=${encodeURIComponent(depositId)}`;

  const { redirectUrl } = await createPaymentPageSession({
    depositId,
    amountCents,
    currency: gate.country.currency,
    returnUrl,
    reason: `${planId} plan (${interval})`,
    customerMessage: `${String(planId).toUpperCase()} ${interval} plan`,
    country: gate.country.iso3,
    metadata: {
      ...baseMeta,
      payment_country: gate.country.label,
    },
  });
  return { ok: true, url: redirectUrl, provider: "pawapay" };
}
