import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  convertUsdCentsToPawapayMinor,
  createPaymentPageSession,
  isPawapayConfigured,
  PawapayReturnUrlError,
  resolvePawapayReturnOrigin,
} from "@/lib/pawapay";
import { requirePawapayPaymentCountry } from "@/lib/pawapay-require-payment-country";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { extractLawIdFromLibraryReturnPath } from "@/lib/library-document-export-path";
import { getLawPrintPriceUsdCents } from "@/lib/platform-settings";

type CheckoutProvider = "pawapay" | "lomi";

/**
 * Create pawaPay Payment Page session for purchasing one document download.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const origin = requestOrigin;
    const body = await request.json().catch(() => ({}));
    const provider = (body.provider as CheckoutProvider | undefined) || "pawapay";
    const pawCurrency = (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase();
    const depositId = crypto.randomUUID();
    let successPath = `/library?session_id=${encodeURIComponent(depositId)}&payg=document`;
    const returnPath = body?.return_path;
    if (typeof returnPath === "string" && returnPath.startsWith("/") && !returnPath.startsWith("//")) {
      successPath = `${returnPath}${returnPath.includes("?") ? "&" : "?"}session_id=${encodeURIComponent(depositId)}&payg=document`;
    }
    const lawId = extractLawIdFromLibraryReturnPath(returnPath);
    const documentPriceCents = await getLawPrintPriceUsdCents();

    if (provider === "lomi") {
      if (!isLomiConfigured()) {
        return NextResponse.json({ error: "Lomi checkout is not configured." }, { status: 503 });
      }
      const currencyCode = toLomiCurrency(pawCurrency);
      if (!currencyCode) {
        return NextResponse.json(
          {
            error:
              "Lomi checkout supports USD, EUR, or XOF. Set PAWAPAY_CURRENCY accordingly or use mobile money.",
          },
          { status: 400 }
        );
      }
      const successUrl = `${origin}${successPath.replace(encodeURIComponent(depositId), "{CHECKOUT_SESSION_ID}")}`;
      const amountMinor = convertUsdCentsToPawapayMinor(documentPriceCents, currencyCode);
      const { checkoutUrl } = await createLomiHostedCheckoutSession({
        amount: amountMinor,
        currency_code: currencyCode,
        metadata: {
          clerk_user_id: userId,
          kind: "payg_document",
          ...(lawId ? { law_id: lawId } : {}),
        },
        title: "Document download",
        success_url: successUrl,
        cancel_url: `${origin}/library?canceled=1`,
      });
      return NextResponse.json({ url: checkoutUrl, provider: "lomi" });
    }

    if (!isPawapayConfigured()) {
      return NextResponse.json({ error: "PawaPay mobile money is not configured." }, { status: 503 });
    }
    const gate = requirePawapayPaymentCountry(body as Record<string, unknown>);
    if (!gate.ok) return gate.response;
    const amountMinor = convertUsdCentsToPawapayMinor(documentPriceCents, gate.country.currency);
    const returnBase = resolvePawapayReturnOrigin(requestOrigin);
    const returnUrl = `${returnBase}${successPath}`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: amountMinor,
      currency: gate.country.currency,
      returnUrl,
      reason: "Document download",
      customerMessage: "One document download - Download and keep forever",
      country: gate.country.iso3,
      metadata: {
        clerk_user_id: userId,
        kind: "payg_document",
        payment_country: gate.country.label,
        ...(lawId ? { law_id: lawId } : {}),
      },
    });

    return NextResponse.json({ url: redirectUrl, provider: "pawapay" });
  } catch (err) {
    console.error("Pay-as-you-go document checkout error:", err);
    if (err instanceof PawapayReturnUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
