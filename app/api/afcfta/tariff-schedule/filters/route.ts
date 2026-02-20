import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET: Return distinct filter values for dropdowns */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const supabase = getSupabaseServer();

    // Get distinct countries
    const { data: countries } = await (supabase.from("afcfta_tariff_schedule") as any)
      .select("country")
      .order("country");

    // Get distinct categories
    const { data: categories } = await (supabase.from("afcfta_tariff_schedule") as any)
      .select("product_category")
      .not("product_category", "is", null)
      .order("product_category");

    // Get distinct sensitivity values
    const { data: sensitivities } = await (supabase.from("afcfta_tariff_schedule") as any)
      .select("sensitivity")
      .not("sensitivity", "is", null)
      .order("sensitivity");

    // Get distinct phase categories
    const { data: phaseCategories } = await (supabase.from("afcfta_tariff_schedule") as any)
      .select("phase_category")
      .not("phase_category", "is", null)
      .order("phase_category");

    const uniqueCountries = Array.from(new Set((countries || []).map((r: { country: string }) => r.country)));
    const uniqueCategories = Array.from(new Set((categories || []).map((r: { product_category: string }) => r.product_category)));
    const uniqueSensitivities = Array.from(new Set((sensitivities || []).map((r: { sensitivity: string }) => r.sensitivity)));
    const uniquePhaseCategories = Array.from(new Set((phaseCategories || []).map((r: { phase_category: string }) => r.phase_category)));

    return NextResponse.json({
      countries: uniqueCountries,
      categories: uniqueCategories,
      sensitivities: uniqueSensitivities,
      phaseCategories: uniquePhaseCategories,
    });
  } catch (err) {
    console.error("Tariff schedule filters API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch filters" },
      { status: 500 }
    );
  }
}
