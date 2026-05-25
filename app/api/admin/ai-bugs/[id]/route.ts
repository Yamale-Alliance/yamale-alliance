import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  const supabase = getSupabaseServer();

  const { data, error } = await (supabase.from("ai_bug_reports") as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const report = data as Record<string, unknown>;
  let queryLog: { query: string; response_preview: string | null; model: string | null } | null =
    null;
  const queryLogId = typeof report.query_log_id === "string" ? report.query_log_id : null;
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

  return NextResponse.json({ report: data, queryLog });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const status = body.status as string | undefined;
  if (!status || !["open", "in_progress", "resolved"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  patch.resolved_at = status === "resolved" ? new Date().toISOString() : null;

  const { data, error } = await (supabase.from("ai_bug_reports") as any)
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ report: data });
}
