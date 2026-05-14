import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createPaymentPageSession, isPawapayConfigured, PawapayReturnUrlError, resolvePawapayReturnOrigin } from "@/lib/pawapay";
import { amountMinorForPawapayCountry } from "@/lib/pawapay-deposit-amount";
import { requirePawapayPaymentCountry } from "@/lib/pawapay-require-payment-country";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { LOMI_MARKETPLACE_ITEM_CHECKOUT_COOKIE } from "@/lib/lomi-marketplace-checkout-cookie";
import type { Database } from "@/lib/database.types";

type MarketplaceItemRow = Database["public"]["Tables"]["marketplace_items"]["Row"];

type CheckoutProvider = "pawapay" | "lomi";

/**
 * Create checkout for a single marketplace item — pawaPay (mobile money) or Lomi (hosted checkout).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const itemId = body.itemId as string | undefined;
    if (!itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }

    let provider: CheckoutProvider = "pawapay";
    if (body.provider === "lomi" || body.provider === "pawapay") {
      provider = body.provider;
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("marketplace_items")
      .select("id, title, description, price_cents, currency")
      .eq("id", itemId)
      .eq("published", true)
      .single();

    const item = data as MarketplaceItemRow | null;
    if (error || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.price_cents <= 0) {
      return NextResponse.json(
        { error: "Free items use Get for free – no checkout" },
        { status: 400 }
      );
    }

    const storedCurrency = (item.currency || process.env.PAWAPAY_CURRENCY || "USD").toUpperCase();
    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const origin = requestOrigin;

    if (provider === "lomi") {
      if (!isLomiConfigured()) {
        return NextResponse.json(
          { error: "Lomi checkout is not configured. Add LOMI_API_KEY or choose mobile money." },
          { status: 503 }
        );
      }
      const currencyCode = toLomiCurrency(storedCurrency);
      if (!currencyCode) {
        return NextResponse.json(
          {
            error:
              "Lomi checkout supports USD, EUR, or XOF only. Use mobile money for other currencies, or change the item currency.",
          },
          { status: 400 }
        );
      }

      const { checkoutUrl, sessionId } = await createLomiHostedCheckoutSession({
        amount: item.price_cents,
        currency_code: currencyCode,
        metadata: {
          clerk_user_id: userId,
          kind: "marketplace",
          marketplace_item_id: itemId,
        },
        title: item.title.slice(0, 80),
        description: (item.description || item.title).slice(0, 200),
        // Lomi does not substitute `{CHECKOUT_SESSION_ID}`; stable return URL + HttpOnly cookie (see lib/lomi-payg-ai-query-cookie.ts pattern).
        success_url: `${origin}/marketplace/${itemId}?payment=verify&from_lomi=1`,
        cancel_url: `${origin}/marketplace/${itemId}?checkout=cancelled`,
      });

      const res = NextResponse.json({ url: checkoutUrl, provider: "lomi" });
      if (sessionId) {
        res.cookies.set(LOMI_MARKETPLACE_ITEM_CHECKOUT_COOKIE, sessionId, {
          path: "/",
          maxAge: 60 * 30,
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
      return res;
    }

    if (!isPawapayConfigured()) {
      return NextResponse.json({ error: "PawaPay mobile money is not configured." }, { status: 503 });
    }

    const gate = requirePawapayPaymentCountry(body);
    if (!gate.ok) return gate.response;

    let amountMinor: number;
    try {
      amountMinor = amountMinorForPawapayCountry(item.price_cents, storedCurrency, gate.country.currency);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Currency mismatch";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const returnBase = resolvePawapayReturnOrigin(requestOrigin);
    const depositId = crypto.randomUUID();
    /** Neutral query until /api/marketplace/confirm-payment verifies COMPLETED — avoids false "success" on cancel. */
    const returnUrl = `${returnBase}/marketplace/${itemId}?payment=verify&session_id=${encodeURIComponent(depositId)}`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: amountMinor,
      currency: gate.country.currency,
      returnUrl,
      reason: item.title.slice(0, 50),
      customerMessage: (item.description || item.title).slice(0, 120),
      country: gate.country.iso3,
      metadata: {
        clerk_user_id: userId,
        marketplace_item_id: itemId,
        kind: "marketplace",
        payment_country: gate.country.label,
      },
    });

    return NextResponse.json({ url: redirectUrl, provider: "pawapay" });
  } catch (err) {
    console.error("Marketplace checkout error:", err);
    if (err instanceof PawapayReturnUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
