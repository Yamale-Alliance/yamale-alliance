import { NextRequest, NextResponse } from "next/server";
import { requireLibraryApiSession } from "@/lib/library-api-auth";
import { fetchLawSummariesByIds } from "@/lib/law-summaries";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET /api/laws/summaries?ids=uuid1,uuid2 — card metadata only (no document body). */
export async function GET(request: NextRequest) {
  try {
    const session = await requireLibraryApiSession();
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const raw = searchParams.get("ids") ?? "";
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);

    if (ids.length === 0) {
      return NextResponse.json({ laws: [] });
    }

    const supabase = getSupabaseServer();
    const laws = await fetchLawSummariesByIds(supabase, ids);
    return NextResponse.json(
      { laws },
      { headers: { "Cache-Control": "private, max-age=60" } }
    );
  } catch (err) {
    console.error("Law summaries API error:", err);
    return NextResponse.json({ error: "Failed to fetch law summaries" }, { status: 500 });
  }
}
