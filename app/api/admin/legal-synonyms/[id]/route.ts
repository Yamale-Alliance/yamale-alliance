import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  const supabase = getSupabaseServer();
  const { error } = await (supabase.from("legal_synonyms") as any).delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  const body = (await request.json()) as {
    term?: string;
    expansion?: string;
    language?: string | null;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.term?.trim()) patch.term = body.term.trim();
  if (body.expansion?.trim()) patch.expansion = body.expansion.trim();
  if (body.language !== undefined) patch.language = body.language?.trim() || null;

  const supabase = getSupabaseServer();
  const { data, error } = await (supabase.from("legal_synonyms") as any)
    .update(patch)
    .eq("id", id)
    .select("id, term, expansion, language, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ synonym: data });
}
