import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(10, Number(sp.get("pageSize") || "20")));
    const rating = Number(sp.get("rating") || "-1");
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = getSupabaseServer();
    const { data, count, error } = await supabase
      .from("ai_response_feedback")
      .select("id,query_log_id,rating,comment,issue_category,issue_details,user_id,user_email,created_at,related_message_id", {
        count: "exact",
      })
      .eq("rating", rating)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      rows: data ?? [],
      page,
      pageSize,
      total: count ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
