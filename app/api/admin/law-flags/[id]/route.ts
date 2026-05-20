import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

const STATUSES = ["open", "in_progress", "resolved", "dismissed"] as const;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  const supabase = getSupabaseServer();

  const { data, error } = await (supabase.from("law_flags") as any).select("*").eq("id", id).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ flag: data });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const status = body.status as string | undefined;
  const adminNotes =
    typeof body.adminNotes === "string" ? body.adminNotes.trim().slice(0, 4000) : undefined;

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (status !== undefined) {
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = status;
    patch.resolved_at =
      status === "resolved" || status === "dismissed" ? new Date().toISOString() : null;
  }

  if (adminNotes !== undefined) {
    patch.admin_notes = adminNotes || null;
  }

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await (supabase.from("law_flags") as any)
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ flag: data });
}
