import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import {
  clampLawPrintPriceUsdCents,
  DEFAULT_LAW_PRINT_PRICE_USD_CENTS,
  formatLawPrintPriceUsd,
  parseLawPrintPriceUsdInput,
} from "@/lib/law-print-pricing";
import { clearPlatformSettingsCache, getLawPrintPriceUsdCents } from "@/lib/platform-settings";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const lawPrintPriceUsdCents = await getLawPrintPriceUsdCents();
    return NextResponse.json({
      lawPrintPriceUsdCents,
      lawPrintPriceDisplay: formatLawPrintPriceUsd(lawPrintPriceUsdCents),
      defaultUsdCents: DEFAULT_LAW_PRINT_PRICE_USD_CENTS,
    });
  } catch (err) {
    console.error("Admin content pricing GET error:", err);
    return NextResponse.json({ error: "Failed to load pricing" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json().catch(() => ({}));
    let cents: number | null = null;

    if (typeof body.lawPrintPriceUsdCents === "number") {
      cents = clampLawPrintPriceUsdCents(body.lawPrintPriceUsdCents);
    } else if (typeof body.lawPrintPriceUsd === "string") {
      cents = parseLawPrintPriceUsdInput(body.lawPrintPriceUsd);
    }

    if (cents === null) {
      return NextResponse.json(
        { error: "Provide lawPrintPriceUsd (e.g. \"3\" or \"2.50\") or lawPrintPriceUsdCents." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { error: updateError } = await (supabase.from("platform_settings") as any)
      .update({
        law_print_price_usd_cents: cents,
        updated_at: new Date().toISOString(),
        updated_by: admin.userId,
      })
      .eq("id", "main");

    if (updateError) {
      console.error("Admin content pricing PATCH error:", updateError);
      const msg = String((updateError as { message?: string }).message ?? "");
      if (/law_print_price_usd_cents|column/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "Database column law_print_price_usd_cents is missing. Run docs/sql/007_law_print_price.sql in Supabase.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: "Failed to update pricing" }, { status: 500 });
    }

    clearPlatformSettingsCache();

    return NextResponse.json({
      ok: true,
      lawPrintPriceUsdCents: cents,
      lawPrintPriceDisplay: formatLawPrintPriceUsd(cents),
    });
  } catch (err) {
    console.error("Admin content pricing PATCH unexpected error:", err);
    return NextResponse.json({ error: "Failed to update pricing" }, { status: 500 });
  }
}
