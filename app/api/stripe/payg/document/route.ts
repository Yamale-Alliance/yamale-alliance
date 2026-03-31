import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentPageSession } from "@/lib/pawapay";

const DOCUMENT_PRICE_CENTS = 300; // $3 per document

/**
 * Create pawaPay Payment Page session for purchasing one document download.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const depositId = crypto.randomUUID();
    let successPath = `/library?session_id=${encodeURIComponent(depositId)}&payg=document`;
    try {
      const body = await request.json();
      const returnPath = body?.return_path;
      if (typeof returnPath === "string" && returnPath.startsWith("/") && !returnPath.startsWith("//")) {
        successPath = `${returnPath}${returnPath.includes("?") ? "&" : "?"}session_id=${encodeURIComponent(depositId)}&payg=document`;
      }
    } catch {
      // ignore invalid body
    }
    const returnUrl = `${origin}${successPath}`;
    const { redirectUrl } = await createPaymentPageSession({
      depositId,
      amountCents: DOCUMENT_PRICE_CENTS,
      currency: (process.env.PAWAPAY_CURRENCY || "USD").toUpperCase(),
      returnUrl,
      reason: "Document download",
      customerMessage: "One document download - Download and keep forever",
      country: process.env.PAWAPAY_COUNTRY,
      metadata: {
        clerk_user_id: userId,
        kind: "payg_document",
      },
    });

    return NextResponse.json({ url: redirectUrl });
  } catch (err) {
    console.error("Pay-as-you-go document checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
