import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { normalizeCategoryName, slugifyCategoryName } from "@/lib/category-slug";
import { getSupabaseServer } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

async function countLawsUsingCategory(supabase: ReturnType<typeof getSupabaseServer>, categoryId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const lawIds = new Set<string>();

  const { data: junctionRows, error: junctionErr } = await db
    .from("law_categories")
    .select("law_id")
    .eq("category_id", categoryId);
  if (junctionErr) throw new Error(junctionErr.message);
  for (const row of junctionRows ?? []) {
    if (row?.law_id) lawIds.add(row.law_id as string);
  }

  const { data: primaryRows, error: primaryErr } = await db
    .from("laws")
    .select("id")
    .eq("category_id", categoryId);
  if (primaryErr) throw new Error(primaryErr.message);
  for (const row of primaryRows ?? []) {
    if (row?.id) lawIds.add(row.id as string);
  }

  return lawIds.size;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Category id is required." }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawName = typeof body?.name === "string" ? body.name : "";
    const name = normalizeCategoryName(rawName);

    if (name.length < 2) {
      return NextResponse.json({ error: "Category name is too short." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: current, error: currentErr } = await db
      .from("categories")
      .select("id,name")
      .eq("id", id)
      .maybeSingle();

    if (currentErr) {
      return NextResponse.json({ error: currentErr.message }, { status: 500 });
    }
    if (!current?.id) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const { data: duplicate } = await db
      .from("categories")
      .select("id,name")
      .ilike("name", name)
      .neq("id", id)
      .limit(1)
      .maybeSingle();

    if (duplicate?.id) {
      return NextResponse.json(
        { error: "Another category already uses this name.", category: duplicate },
        { status: 409 }
      );
    }

    const slug = slugifyCategoryName(name) || null;
    const { data, error } = await db
      .from("categories")
      .update({ name, slug })
      .eq("id", id)
      .select("id,name,slug")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to update category." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, category: data });
  } catch (err) {
    console.error("Admin categories PATCH error:", err);
    return NextResponse.json({ error: "Failed to update category." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Category id is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: current, error: currentErr } = await db
      .from("categories")
      .select("id,name")
      .eq("id", id)
      .maybeSingle();

    if (currentErr) {
      return NextResponse.json({ error: currentErr.message }, { status: 500 });
    }
    if (!current?.id) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const lawCount = await countLawsUsingCategory(supabase, id);
    if (lawCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete: ${lawCount} law(s) use this category. Reassign or remove them first.`,
          lawCount,
        },
        { status: 409 }
      );
    }

    const { error } = await db.from("categories").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin categories DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete category." }, { status: 500 });
  }
}
