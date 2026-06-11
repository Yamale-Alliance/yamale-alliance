import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMarketplaceBrowsePayload } from "@/lib/marketplace-browse-data";

/** GET: published vault catalog + series registry. Signed-in users get owned flags. */
export async function GET() {
  try {
    const { userId } = await auth();
    const payload = await fetchMarketplaceBrowsePayload(userId);
    return NextResponse.json(payload, {
      headers: userId
        ? { "Cache-Control": "private, no-store" }
        : {
            "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
          },
    });
  } catch (err) {
    console.error("Marketplace API error:", err);
    return NextResponse.json({ error: "Failed to load The Yamalé Vault" }, { status: 500 });
  }
}
