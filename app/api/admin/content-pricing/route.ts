import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import {
  contentPricingDbColumn,
  contentPricingToApiPayload,
  CONTENT_PRICING_DEFAULTS,
  parseContentPricingPatchBody,
  type ContentPricingKey,
} from "@/lib/content-pricing";
import { clearPlatformSettingsCache, getPlatformSettings } from "@/lib/platform-settings";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const settings = await getPlatformSettings();
    return NextResponse.json({
      ...contentPricingToApiPayload(settings),
      defaults: CONTENT_PRICING_DEFAULTS,
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
    const patch = parseContentPricingPatchBody(body as Record<string, unknown>);
    const keys = Object.keys(patch) as ContentPricingKey[];
    if (keys.length === 0) {
      return NextResponse.json(
        {
          error:
            "Provide at least one price field (e.g. dayPassPriceUsd, lawyerSearchUnlockPriceUsd, lawPrintPriceUsd).",
        },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: admin.userId,
    };
    for (const key of keys) {
      const cents = patch[key];
      if (typeof cents === "number") {
        updates[contentPricingDbColumn(key)] = cents;
      }
    }

    const supabase = getSupabaseServer();
    const { error: updateError } = await (supabase.from("platform_settings") as any)
      .update(updates)
      .eq("id", "main");

    if (updateError) {
      console.error("Admin content pricing PATCH error:", updateError);
      const msg = String((updateError as { message?: string }).message ?? "");
      if (/column|does not exist/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "Pricing columns are missing in platform_settings. Run supabase/migrations/20260520100000_platform_payg_pricing.sql.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: "Failed to update pricing" }, { status: 500 });
    }

    clearPlatformSettingsCache();
    const settings = await getPlatformSettings();

    return NextResponse.json({
      ok: true,
      ...contentPricingToApiPayload(settings),
    });
  } catch (err) {
    console.error("Admin content pricing PATCH unexpected error:", err);
    return NextResponse.json({ error: "Failed to update pricing" }, { status: 500 });
  }
}
