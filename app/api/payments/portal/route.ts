import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
/** pawaPay has no Stripe-style billing portal endpoint. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    void request;
    return NextResponse.json(
      {
        error:
          "Self-serve billing portal is not available with pawaPay integration. Contact support for plan changes.",
      },
      { status: 400 }
    );
  } catch (err) {
    console.error("pawaPay portal route error:", err);
    return NextResponse.json(
      { error: "Could not open billing portal" },
      { status: 500 }
    );
  }
}
