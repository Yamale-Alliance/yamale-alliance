import { NextRequest, NextResponse } from "next/server";

/** Lomi has no Stripe-style billing portal endpoint. */
export async function POST(_request: NextRequest) {
  try {
    return NextResponse.json(
      {
        error:
          "Self-serve billing portal is not available. Contact support for plan changes.",
      },
      { status: 400 }
    );
  } catch (err) {
    console.error("Billing portal route error:", err);
    return NextResponse.json({ error: "Portal unavailable" }, { status: 500 });
  }
}
