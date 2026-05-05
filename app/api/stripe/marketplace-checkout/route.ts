import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createPaymentPageSession, isPawapayConfigured, resolvePawapayReturnOrigin } from "@/lib/pawapay";
import { amountMinorForPawapayCountry } from "@/lib/pawapay-deposit-amount";
import { requirePawapayPaymentCountry } from "@/lib/pawapay-require-payment-country";
import type { Database } from "@/lib/database.types";

type MarketplaceItemRow = Database["public"]["Tables"]["marketplace_items"]["Row"];

/**
 * Create pawaPay Payment Page session for a marketplace item.
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

    if (!isPawapayConfigured()) {
      return NextResponse.json({ error: "PawaPay mobile money is not configured." }, { status: 503 });
    }

    const gate = requirePawapayPaymentCountry(body);
    if (!gate.ok) return gate.response;

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
    let amountMinor: number;
    try {
      amountMinor = amountMinorForPawapayCountry(item.price_cents, storedCurrency, gate.country.currency);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Currency mismatch";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const requestOrigin = request.headers.get("origin") || request.nextUrl.origin;
    const returnBase = resolvePawapayReturnOrigin(requestOrigin);
    const depositId = crypto.randomUUID();
    const returnUrl = `${returnBase}/marketplace/${itemId}?checkout=success&session_id=${encodeURIComponent(depositId)}`;
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

    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("Marketplace checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
