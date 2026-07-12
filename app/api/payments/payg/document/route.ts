import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { convertUsdCentsToMinor, getCheckoutCurrency } from "@/lib/payment-currency";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { buildLomiOneTimeCatalogCheckoutInput } from "@/lib/lomi-catalog-checkout";
import { extractLawIdFromLibraryReturnPath } from "@/lib/library-document-export-path";
import { getLawPrintPriceUsdCents } from "@/lib/platform-settings";

/** Create Lomi checkout session for purchasing one document download. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const origin = requestOrigin;
    const body = await request.json().catch(() => ({}));
    const returnPath = body?.return_path;
    let successPath = `/library?session_id={CHECKOUT_SESSION_ID}&payg=document`;
    if (typeof returnPath === "string" && returnPath.startsWith("/") && !returnPath.startsWith("//")) {
      successPath = `${returnPath}${returnPath.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}&payg=document`;
    }
    const lawId = extractLawIdFromLibraryReturnPath(returnPath);
    const documentPriceCents = await getLawPrintPriceUsdCents();

    if (!isLomiConfigured()) {
      return NextResponse.json({ error: "Lomi checkout is not configured." }, { status: 503 });
    }
    const currencyCode = toLomiCurrency(getCheckoutCurrency());
    if (!currencyCode) {
      return NextResponse.json(
        { error: "Lomi checkout supports USD, EUR, or XOF. Set CHECKOUT_CURRENCY accordingly." },
        { status: 400 }
      );
    }
    const successUrl = `${origin}${successPath}`;
    const amountMinor = convertUsdCentsToMinor(documentPriceCents, currencyCode);
    const { checkoutUrl } = await createLomiHostedCheckoutSession(
      buildLomiOneTimeCatalogCheckoutInput({
        catalogKey: "payg_document",
        amountMinor,
        currency_code: currencyCode,
        metadata: {
          clerk_user_id: userId,
          kind: "payg_document",
          payment_provider: "lomi",
          ...(lawId ? { law_id: lawId } : {}),
        },
        title: "Document download",
        success_url: successUrl,
        cancel_url: `${origin}/library?canceled=1`,
      })
    );
    return NextResponse.json({ url: checkoutUrl, provider: "lomi" });
  } catch (err) {
    console.error("Pay-as-you-go document checkout error:", err);
    const msg = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
