import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/** GET paginated AI query logs (audit 7.2). */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "40")));
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0"));

  const supabase = getSupabaseServer();
  const { data, error, count } = await (supabase.from("ai_query_log") as any)
    .select(
      "id, user_id, query, country_detected, frameworks_detected, retrieved_law_ids, system_prompt_version, model, latency_ms, citation_issues, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: data ?? [],
    total: count ?? (data?.length ?? 0),
    limit,
    offset,
  });
}
