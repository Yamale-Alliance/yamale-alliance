import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Flagged (negative) AI feedback for admin. Rich fields live on `ai_bug_reports`
 * (created by POST /api/ai/feedback when rating === -1), not on `ai_response_feedback`
 * (thumbs row is minimal: user_id, rating, comment, query_log_id).
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return admin;
    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(10, Number(sp.get("pageSize") || "20")));
    const status = (sp.get("status") ?? "open").trim() || "open";
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = getSupabaseServer();
    let q = (supabase.from("ai_bug_reports") as any)
      .select(
        "id,query_log_id,related_message_id,issue_category,issue_details,user_id,user_email,created_at,status",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (status !== "all") {
      q = q.eq("status", status);
    }

    const { data, count, error } = await q.range(from, to);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      query_log_id: r.query_log_id ?? null,
      rating: -1,
      comment: r.issue_details ?? null,
      issue_category: r.issue_category ?? null,
      issue_details: r.issue_details ?? null,
      user_id: r.user_id ?? null,
      user_email: r.user_email ?? null,
      created_at: r.created_at,
      related_message_id: r.related_message_id ?? null,
      status: r.status ?? null,
    }));

    return NextResponse.json({
      rows,
      page,
      pageSize,
      total: count ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
