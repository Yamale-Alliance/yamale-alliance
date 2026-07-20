import { NextRequest, NextResponse } from "next/server";
import { expertiseMatchesSelection } from "@/lib/lawyer-expertise";
import { lawyerCountryMatches } from "@/lib/lawyer-countries";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * GET ?country=Ghana&expertise=Corporate Law
 * Returns count of approved lawyers in that country whose expertise matches.
 * Country fields may list multiple countries (comma-separated).
 */
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country")?.trim() ?? "";
  const expertise = req.nextUrl.searchParams.get("expertise")?.trim() ?? "";
  if (!country || !expertise) {
    return NextResponse.json({ error: "country and expertise are required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("lawyers") as any)
      .select("country, expertise")
      .eq("approved", true);

    if (error) {
      console.error("lawyers match-count:", error);
      return NextResponse.json({ error: "Failed to count lawyers" }, { status: 500 });
    }

    const rows = (data ?? []) as Array<{ country: string | null; expertise: string }>;
    const count = rows.filter(
      (row) =>
        lawyerCountryMatches(row.country, country) &&
        expertiseMatchesSelection(row.expertise ?? "", expertise)
    ).length;

    return NextResponse.json({ count });
  } catch (e) {
    console.error("lawyers match-count:", e);
    return NextResponse.json({ error: "Failed to count lawyers" }, { status: 500 });
  }
}
