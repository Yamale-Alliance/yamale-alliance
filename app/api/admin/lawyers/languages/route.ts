import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { canonicalLawyerLanguage } from "@/lib/lawyer-languages";
import {
  fetchAdminLawyerLanguages,
  validateCatalogName,
} from "@/lib/lawyer-catalog-server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const languages = await fetchAdminLawyerLanguages();
    return NextResponse.json({ languages });
  } catch (err) {
    console.error("Admin lawyer languages GET error:", err);
    return NextResponse.json({ error: "Failed to load languages." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json().catch(() => ({}));
    const rawName = typeof body?.name === "string" ? body.name : "";
    const validated = validateCatalogName(rawName);
    if (!validated) {
      return NextResponse.json({ error: "Language name is too short." }, { status: 400 });
    }
    const name = canonicalLawyerLanguage(validated);

    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: existing } = await db
      .from("lawyer_language_options")
      .select("id,name")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json(
        { error: "Language already exists.", language: existing },
        { status: 409 }
      );
    }

    const { data: maxRow } = await db
      .from("lawyer_language_options")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = typeof maxRow?.sort_order === "number" ? maxRow.sort_order + 10 : 10;

    const { data, error } = await db
      .from("lawyer_language_options")
      .insert({ name, sort_order: sortOrder })
      .select("id,name,sort_order,created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create language." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      language: { ...data, name: canonicalLawyerLanguage(data.name), usageCount: 0 },
    });
  } catch (err) {
    console.error("Admin lawyer languages POST error:", err);
    return NextResponse.json({ error: "Failed to create language." }, { status: 500 });
  }
}
