import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createPaymentPageSession, isPawapayConfigured, PawapayReturnUrlError, resolvePawapayReturnOrigin } from "@/lib/pawapay";
import { amountMinorForPawapayCountry } from "@/lib/pawapay-deposit-amount";
import { createLomiHostedCheckoutSession, isLomiConfigured, toLomiCurrency } from "@/lib/lomi-checkout";
import { LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE } from "@/lib/lomi-marketplace-checkout-cookie";
import { requirePawapayPaymentCountry } from "@/lib/pawapay-require-payment-country";

type PricedLine = {
  currency: string;
  title: string;
  price_cents: number;
  quantity: number;
};

/**
 * Replace the user's cart with the given marketplace item ids, then start checkout.
 * Multi-item cart checkout at catalog list prices. ZIP package bundle tiers use
 * {@link /api/payments/marketplace-checkout} with tier=bundle (add-on + selected partner item).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const rawIds = body.marketplace_item_ids ?? body.itemIds;
    const itemIds = Array.isArray(rawIds)
      ? rawIds.filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];

    if (itemIds.length === 0) {
      return NextResponse.json({ error: "marketplace_item_ids is required" }, { status: 400 });
    }

    let provider: "pawapay" | "lomi" = "pawapay";
    if (body.provider === "lomi" || body.provider === "pawapay") {
      provider = body.provider;
    }

    let successPath = "/marketplace";
    const sp = body.success_path ?? body.successPath;
    if (typeof sp === "string" && sp.startsWith("/marketplace/") && !sp.startsWith("//") && !sp.includes("://")) {
      const pathOnly = sp.split("?")[0];
      if (pathOnly.length <= 240) successPath = pathOnly;
    }

    const supabase = getSupabaseServer();
    const { data: rows, error: itemsError } = await supabase
      .from("marketplace_items")
      .select("id, title, price_cents, currency, published")
      .in("id", itemIds)
      .eq("published", true);

    if (itemsError || !rows || rows.length !== itemIds.length) {
      return NextResponse.json({ error: "One or more items not found" }, { status: 404 });
    }

    type ItemRow = {
      id: string;
      title: string;
      price_cents: number;
      currency: string | null;
      published: boolean;
    };
    const itemRows = rows as ItemRow[];

    const pricedItems: PricedLine[] = itemRows.map((r) => ({
      currency: (r.currency || process.env.PAWAPAY_CURRENCY || "USD").toUpperCase(),
      title: r.title,
      price_cents: Number(r.price_cents) || 0,
      quantity: 1,
    }));

    if (pricedItems.some((x) => x.price_cents <= 0)) {
      return NextResponse.json({ error: "Bundle includes a free item — use claim flow instead" }, { status: 400 });
    }

    const currencies = Array.from(new Set(pricedItems.map((x) => x.currency)));
    if (currencies.length !== 1) {
      return NextResponse.json({ error: "Bundle items must share one currency" }, { status: 400 });
    }

    const currency = currencies[0];
    const amountCents = pricedItems.reduce((sum, x) => sum + x.price_cents * x.quantity, 0);
    const itemIdsCsv = itemIds.join(",");
    const itemIdsJson = JSON.stringify(itemIds);

    await supabase.from("shopping_cart_items").delete().eq("user_id", userId);

    const { error: insertError } = await (supabase.from("shopping_cart_items") as any).insert(
      itemIds.map((marketplace_item_id) => ({
        user_id: userId,
        marketplace_item_id,
        quantity: 1,
        updated_at: new Date().toISOString(),
      }))
    );

    if (insertError) {
      console.error("checkout-items cart insert:", insertError);
      return NextResponse.json({ error: "Failed to prepare cart" }, { status: 500 });
    }

    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const origin = requestOrigin;

    const buildReturnUrl = (extra: Record<string, string>) => {
      const u = new URL(successPath, origin);
      for (const [k, v] of Object.entries(extra)) {
        u.searchParams.set(k, v);
      }
      return u.toString();
    };

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
          { error: "Lomi checkout supports USD, EUR, or XOF only." },
          { status: 400 }
        );
      }

      if (itemIdsCsv.length > 500) {
        return NextResponse.json({ error: "Too many items for hosted checkout metadata." }, { status: 400 });
      }

      const { checkoutUrl, sessionId } = await createLomiHostedCheckoutSession({
        amount: amountCents,
        currency_code: currencyCode,
        metadata: {
          clerk_user_id: userId,
          kind: "marketplace_cart",
          item_ids: itemIdsCsv,
        },
        title: "Yamalé Vault bundle",
        description: pricedItems.map((x) => x.title).join(" + ").slice(0, 200),
        success_url: buildReturnUrl({ payment: "verify", from_lomi: "1", ...(body.bundle_return ? { bundle: "1" } : {}) }),
        cancel_url: buildReturnUrl({ canceled: "1", ...(body.bundle_return ? { bundle: "1" } : {}) }),
      });

      const res = NextResponse.json({ url: checkoutUrl, provider: "lomi", amount_cents: amountCents });
      if (sessionId) {
        res.cookies.set(LOMI_MARKETPLACE_CART_CHECKOUT_COOKIE, sessionId, {
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
      amountMinor = amountMinorForPawapayCountry(amountCents, currency, gate.country.currency);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Currency mismatch";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const depositId = crypto.randomUUID();
    const returnBase = resolvePawapayReturnOrigin(requestOrigin);
    const pawapayReturn = new URL(successPath, returnBase);
    pawapayReturn.searchParams.set("payment", "verify");
    pawapayReturn.searchParams.set("session_id", depositId);
    if (body.bundle_return) pawapayReturn.searchParams.set("bundle", "1");
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: amountMinor,
      currency: gate.country.currency,
      returnUrl: pawapayReturn.toString(),
      reason: "Yamalé Vault bundle",
      customerMessage: pricedItems.map((x) => x.title).join(" + ").slice(0, 120),
      country: gate.country.iso3,
      metadata: {
        clerk_user_id: userId,
        kind: "marketplace_cart",
        item_ids: itemIdsJson,
        payment_country: gate.country.label,
      },
    });

    return NextResponse.json({ url: redirectUrl, provider: "pawapay", amount_cents: amountCents });
  } catch (err) {
    console.error("checkout-items error:", err);
    if (err instanceof PawapayReturnUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
