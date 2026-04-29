import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Sanitize for use inside PostgREST ilike pattern (avoid % / _ injection). */
function sanitizeIlikeFragment(s: string): string {
  return s.trim().slice(0, 200).replace(/[%_\\]/g, "");
}

/**
 * GET ?country=Ghana&expertise=Corporate Law
 * Returns count of approved lawyers in that country whose expertise string matches (case-insensitive).
 */
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country")?.trim() ?? "";
  const expertise = req.nextUrl.searchParams.get("expertise")?.trim() ?? "";
  if (!country || !expertise) {
    return NextResponse.json({ error: "country and expertise are required" }, { status: 400 });
  }

  const pattern = `%${sanitizeIlikeFragment(expertise)}%`;
  if (pattern === "%%") {
    return NextResponse.json({ count: 0 });
  }

  try {
    const supabase = getSupabaseServer();
    const { count, error } = await (supabase.from("lawyers") as any)
      .select("*", { count: "exact", head: true })
      .eq("approved", true)
      .eq("country", country)
      .ilike("expertise", pattern);

    if (error) {
      console.error("lawyers match-count:", error);
      return NextResponse.json({ error: "Failed to count lawyers" }, { status: 500 });
    }
    return NextResponse.json({ count: count ?? 0 });
  } catch (e) {
    console.error("lawyers match-count:", e);
    return NextResponse.json({ error: "Failed to count lawyers" }, { status: 500 });
  }
}
