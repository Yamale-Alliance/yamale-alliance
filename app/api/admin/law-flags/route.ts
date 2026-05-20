import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Admin list of user law flags. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") ?? "open").trim();
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "40")));
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0"));

  const supabase = getSupabaseServer();
  let query = (supabase.from("law_flags") as any).select(
    "id, law_id, law_title, law_country, law_category, issue_category, issue_details, user_id, user_name, user_email, status, created_at, updated_at",
    { count: "exact" }
  );
  if (status !== "all") {
    query = query.eq("status", status);
  }
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    flags: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}
