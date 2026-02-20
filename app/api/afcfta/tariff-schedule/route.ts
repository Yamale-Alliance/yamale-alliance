import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const searchParams = request.nextUrl.searchParams;
    const country = searchParams.get("country");
    const hsCode = searchParams.get("hsCode");
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const sensitivity = searchParams.get("sensitivity");
    const phaseCategory = searchParams.get("phaseCategory");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    let query = (supabase.from("afcfta_tariff_schedule") as any)
      .select("*", { count: "exact" });

    // Apply filters
    if (country) {
      query = query.eq("country", country);
    }
    if (hsCode) {
      query = query.ilike("hs_code", `%${hsCode}%`);
    }
    if (category) {
      query = query.eq("product_category", category);
    }
    if (sensitivity) {
      query = query.eq("sensitivity", sensitivity);
    }
    if (phaseCategory) {
      query = query.eq("phase_category", phaseCategory);
    }
    if (search) {
      query = query.or(`product_description.ilike.%${search}%,hs_code.ilike.%${search}%`);
    }

    // Order by HS code
    query = query.order("hs_code", { ascending: true });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching tariff schedule:", error);
      return NextResponse.json(
        { error: "Failed to fetch tariff schedule", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
      count: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("Tariff schedule API error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to fetch tariff schedule", details: message },
      { status: 500 }
    );
  }
}
