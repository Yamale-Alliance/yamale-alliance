import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const { searchParams } = new URL(request.url);
    const countryId = searchParams.get("countryId") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const q = searchParams.get("q") ?? undefined;

    const [countriesRes, categoriesRes, lawsRes] = await Promise.all([
      supabase.from("countries").select("id, name, region").order("name"),
      supabase.from("categories").select("id, name, slug").order("name"),
      (() => {
        let query = supabase
          .from("laws")
          .select("id, title, source_url, source_name, year, status, country_id, category_id, countries(name), categories(name)")
          .order("title");
        if (countryId) query = query.eq("country_id", countryId);
        if (categoryId) query = query.eq("category_id", categoryId);
        if (status) query = query.eq("status", status);
        if (q && q.trim()) {
          query = query.ilike("title", `%${q.trim()}%`);
        }
        return query;
      })(),
    ]);

    if (countriesRes.error) throw countriesRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (lawsRes.error) throw lawsRes.error;

    return NextResponse.json({
      countries: countriesRes.data ?? [],
      categories: categoriesRes.data ?? [],
      laws: lawsRes.data ?? [],
    });
  } catch (err) {
    console.error("Laws API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch laws" },
      { status: 500 }
    );
  }
}
