import { NextResponse } from "next/server";
import { formatLawPrintPriceUsd } from "@/lib/law-print-pricing";
import { getLawPrintPriceUsdCents } from "@/lib/platform-settings";

/** Public list price for law PDF print/unlock (used by library and pricing UI). */
export async function GET() {
  try {
    const lawPrintPriceUsdCents = await getLawPrintPriceUsdCents();
    return NextResponse.json({
      lawPrintPriceUsdCents,
      lawPrintPriceDisplay: formatLawPrintPriceUsd(lawPrintPriceUsdCents),
    });
  } catch (err) {
    console.error("Law print price GET error:", err);
    return NextResponse.json({ error: "Failed to load price" }, { status: 500 });
  }
}
