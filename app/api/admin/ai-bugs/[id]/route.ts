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
  return NextResponse.json({ report: data });
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
