import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createPaymentPageSession, isPawapayConfigured, PawapayReturnUrlError, resolvePawapayReturnOrigin } from "@/lib/pawapay";
import { amountMinorForPawapayCountry } from "@/lib/pawapay-deposit-amount";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { requirePawapayPaymentCountry } from "@/lib/pawapay-require-payment-country";

type PricedLine = {
  currency: string;
  title: string;
  price_cents: number;
  quantity: number;
};

/** POST: create checkout — pawaPay (mobile money) or Lomi (hosted checkout). Body: { provider?, success_path?, paymentCountry? } */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    let provider: "pawapay" | "lomi" = "pawapay";
    let successPath = "/marketplace";
    if (body?.provider === "lomi" || body?.provider === "pawapay") {
      provider = body.provider;
    }
    const sp = body?.success_path ?? body?.successPath;
    if (typeof sp === "string" && sp.startsWith("/marketplace/") && !sp.startsWith("//") && !sp.includes("://")) {
      const pathOnly = sp.split("?")[0];
      if (pathOnly.length <= 240) successPath = pathOnly;
    }

    const supabase = getSupabaseServer();
    const { data: cartItems, error: cartError } = await supabase
      .from("shopping_cart_items")
      .select(
        `
        marketplace_item_id,
        quantity,
        marketplace_items (
          id,
          title,
          price_cents,
          currency
        )
      `
      )
      .eq("user_id", userId);

    if (cartError || !cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const pricedItems = cartItems
      .map((item: any) => {
        const marketplaceItem = item.marketplace_items;
        if (!marketplaceItem || marketplaceItem.price_cents === 0) return null;
        return {
          currency: (marketplaceItem.currency || process.env.PAWAPAY_CURRENCY || "USD").toUpperCase(),
          title: marketplaceItem.title as string,
          price_cents: Number(marketplaceItem.price_cents) || 0,
          quantity: item.quantity || 1,
        };
      })
      .filter((x): x is PricedLine => x != null);

    if (pricedItems.length === 0) {
      return NextResponse.json({ error: "No items to checkout" }, { status: 400 });
    }

    const currencies = Array.from(new Set(pricedItems.map((x) => x.currency)));
    if (currencies.length !== 1) {
      return NextResponse.json({ error: "Cart checkout supports one currency at a time" }, { status: 400 });
    }
    const currency = currencies[0];
    const amountCents = pricedItems.reduce((sum, x) => sum + x.price_cents * x.quantity, 0);
    const itemIdsList = cartItems.map((item: any) => item.marketplace_item_id as string);
    const itemIdsCsv = itemIdsList.join(",");
    const itemIdsJson = JSON.stringify(itemIdsList);
    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const origin = requestOrigin;

    if (provider === "lomi") {
      if (!isLomiConfigured()) {
        return NextResponse.json(
          { error: "Lomi checkout is not configured. Add LOMI_API_KEY or choose mobile money." },
          { status: 503 }
        );
      }

      const currencyCode = toLomiCurrency(currency);
      if (!currencyCode) {
        return NextResponse.json(
          {
            error:
              "Lomi checkout supports USD, EUR, or XOF only. Use mobile money for other currencies, or change cart currency.",
          },
          { status: 400 }
        );
      }

      if (itemIdsCsv.length > 500) {
        return NextResponse.json(
          { error: "Cart is too large for hosted checkout metadata. Remove some items or use mobile money." },
          { status: 400 }
        );
      }

      const { checkoutUrl } = await createLomiHostedCheckoutSession({
        amount: amountCents,
        currency_code: currencyCode,
        metadata: {
          clerk_user_id: userId,
          kind: "marketplace_cart",
          item_ids: itemIdsCsv,
        },
        title: "The Yamale Vault cart",
        description: "Marketplace cart checkout",
        success_url: `${origin}${successPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${successPath}?canceled=1`,
      });

      return NextResponse.json({ url: checkoutUrl, provider: "lomi" });
    }

    if (!isPawapayConfigured()) {
      return NextResponse.json({ error: "PawaPay mobile money is not configured." }, { status: 503 });
    }

    const gate = requirePawapayPaymentCountry(body);
    if (!gate.ok) return gate.response;

    let amountMinor: number;
    try {
      amountMinor = amountMinorForPawapayCountry(amountCents, currency, gate.country.currency);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Currency mismatch";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const depositId = crypto.randomUUID();
    const returnBase = resolvePawapayReturnOrigin(requestOrigin);
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: amountMinor,
      currency: gate.country.currency,
      returnUrl: `${returnBase}${successPath}?checkout=success&session_id=${encodeURIComponent(depositId)}`,
      reason: "The Yamale Vault cart",
      customerMessage: "The Yamale Vault cart checkout",
      country: gate.country.iso3,
      metadata: {
        clerk_user_id: userId,
        kind: "marketplace_cart",
        item_ids: itemIdsJson,
        payment_country: gate.country.label,
      },
    });

    await supabase.from("shopping_cart_items").delete().eq("user_id", userId);

    return NextResponse.json({ url: redirectUrl, provider: "pawapay" });
  } catch (err) {
    console.error("Cart checkout error:", err);
    if (err instanceof PawapayReturnUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
