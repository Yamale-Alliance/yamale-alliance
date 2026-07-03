import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const supabase = getSupabaseServer();
  const { data, error } = await (supabase.from("legal_synonyms") as any)
    .select("id, term, expansion, language, created_at, updated_at")
    .order("term")
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ synonyms: data ?? [] });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const body = (await request.json()) as {
    term?: string;
    expansion?: string;
    language?: string | null;
  };

  const term = body.term?.trim();
  const expansion = body.expansion?.trim();
  if (!term || !expansion) {
    return NextResponse.json({ error: "term and expansion are required" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await (supabase.from("legal_synonyms") as any)
    .insert({
      term,
      expansion,
      language: body.language?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .select("id, term, expansion, language, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ synonym: data });
}
