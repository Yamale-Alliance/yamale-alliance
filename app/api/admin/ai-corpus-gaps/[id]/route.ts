import { NextRequest, NextResponse } from "next/server";
import { parseQueryLogIdFromIssueDetails } from "@/lib/ai-corpus-gap-parse";
import { isAiAutoLawFlagCategory } from "@/lib/law-flag-categories";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  const supabase = getSupabaseServer();

  const { data: flag, error } = await (supabase.from("law_flags") as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!flag) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isAiAutoLawFlagCategory(flag.issue_category)) {
    return NextResponse.json(
      { error: "This flag is not an auto corpus gap report" },
      { status: 400 }
    );
  }

  const queryLogId =
    parseQueryLogIdFromIssueDetails(flag.issue_details) ?? null;

  let bugReport: Record<string, unknown> | null = null;
  if (queryLogId) {
    const { data: bug } = await (supabase.from("ai_bug_reports") as any)
      .select(
        "id, issue_category, issue_details, conversation_snapshot, created_at, query_log_id"
      )
      .eq("query_log_id", queryLogId)
      .like("issue_category", "auto_ai_%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    bugReport = bug ?? null;
  }

  let queryLog: { query: string; response_preview: string | null; model: string | null } | null =
    null;
  if (queryLogId) {
    const { data: logRow } = await (supabase.from("ai_query_log") as any)
      .select("query, response_preview, model")
      .eq("id", queryLogId)
      .maybeSingle();
    if (logRow) {
      queryLog = {
        query: String(logRow.query ?? ""),
        response_preview:
          logRow.response_preview != null ? String(logRow.response_preview) : null,
        model: logRow.model != null ? String(logRow.model) : null,
      };
    }
  }

  return NextResponse.json({
    flag,
    bugReport,
    queryLog,
    queryLogId,
  });
}
