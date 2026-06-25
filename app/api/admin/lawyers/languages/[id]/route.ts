import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { canonicalLawyerLanguage, lawyerLanguageKey } from "@/lib/lawyer-languages";
import {
  countLawyersUsingLanguage,
  fetchLawyerLanguageRows,
  replaceLanguageInLawyers,
  validateCatalogName,
} from "@/lib/lawyer-catalog-server";
import { getSupabaseServer } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Language id is required." }, { status: 400 });
  }

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

    const { data: current, error: currentErr } = await db
      .from("lawyer_language_options")
      .select("id,name")
      .eq("id", id)
      .maybeSingle();

    if (currentErr) {
      return NextResponse.json({ error: currentErr.message }, { status: 500 });
    }
    if (!current?.id) {
      return NextResponse.json({ error: "Language not found." }, { status: 404 });
    }

    const oldName = canonicalLawyerLanguage(current.name);
    if (lawyerLanguageKey(oldName) === lawyerLanguageKey(name)) {
      return NextResponse.json({ ok: true, language: { ...current, name: oldName } });
    }

    const { data: duplicate } = await db
      .from("lawyer_language_options")
      .select("id,name")
      .ilike("name", name)
      .neq("id", id)
      .limit(1)
      .maybeSingle();

    if (duplicate?.id) {
      return NextResponse.json(
        { error: "Another language already uses this name.", language: duplicate },
        { status: 409 }
      );
    }

    const { data, error } = await db
      .from("lawyer_language_options")
      .update({ name })
      .eq("id", id)
      .select("id,name,sort_order,created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to update language." },
        { status: 500 }
      );
    }

    await replaceLanguageInLawyers(oldName, name);

    const lawyers = await fetchLawyerLanguageRows();
    return NextResponse.json({
      ok: true,
      language: {
        ...data,
        name: canonicalLawyerLanguage(data.name),
        usageCount: countLawyersUsingLanguage(lawyers, data.name),
      },
    });
  } catch (err) {
    console.error("Admin lawyer languages PATCH error:", err);
    return NextResponse.json({ error: "Failed to update language." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Language id is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: current, error: currentErr } = await db
      .from("lawyer_language_options")
      .select("id,name")
      .eq("id", id)
      .maybeSingle();

    if (currentErr) {
      return NextResponse.json({ error: currentErr.message }, { status: 500 });
    }
    if (!current?.id) {
      return NextResponse.json({ error: "Language not found." }, { status: 404 });
    }

    const lawyers = await fetchLawyerLanguageRows();
    const usageCount = countLawyersUsingLanguage(lawyers, current.name);
    if (usageCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete: ${usageCount} lawyer(s) use this language.`,
          usageCount,
        },
        { status: 409 }
      );
    }

    const { error } = await db.from("lawyer_language_options").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin lawyer languages DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete language." }, { status: 500 });
  }
}
