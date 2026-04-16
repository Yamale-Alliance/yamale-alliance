import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { Database } from "@/lib/database.types";

type LawRow = Database["public"]["Tables"]["laws"]["Row"];

/** GET: find duplicate law titles within a single country+category (ignores global laws). */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const url = req.nextUrl;
  const countryId = url.searchParams.get("countryId") ?? "";
  const categoryId = url.searchParams.get("categoryId") ?? "";

  if (!countryId || !categoryId) {
    return NextResponse.json(
      { error: "countryId and categoryId are required query parameters" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("laws")
      .select("id, title, year, status, source_url, country_id, category_id, created_at")
      .eq("country_id", countryId)
      .eq("category_id", categoryId)
      .eq("applies_to_all_countries", false)
      .order("created_at", { ascending: true })
      .limit(5000);

    if (error) {
      console.error("Admin laws duplicates GET error:", error);
      return NextResponse.json({ error: "Failed to load laws", details: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as LawRow[];
    const groups = new Map<string, LawRow[]>();

    for (const row of rows) {
      const key = (row.title ?? "").trim().toLowerCase();
      if (!key) continue;
      const arr = groups.get(key) ?? [];
      arr.push(row);
      groups.set(key, arr);
    }

    const duplicates = Array.from(groups.entries())
      .filter(([, arr]) => arr.length > 1)
      .map(([normalizedTitle, laws]) => ({
        normalizedTitle,
        title: laws[0]?.title ?? "",
        count: laws.length,
        laws: laws.map((l) => ({
          id: l.id,
          title: l.title,
          year: l.year,
          status: l.status,
          source_url: l.source_url,
          created_at: l.created_at,
        })),
      }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

    return NextResponse.json({ ok: true, countryId, categoryId, duplicates });
  } catch (err) {
    console.error("Admin laws duplicates error:", err);
    return NextResponse.json({ error: "Failed to compute duplicates" }, { status: 500 });
  }
}

