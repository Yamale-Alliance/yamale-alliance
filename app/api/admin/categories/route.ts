import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { normalizeCategoryName, slugifyCategoryName } from "@/lib/category-slug";
import { getSupabaseServer } from "@/lib/supabase/server";

function countLawsPerCategory(
  junctionRows: Array<{ category_id: string; law_id: string }>,
  primaryRows: Array<{ id: string; category_id: string | null }>
): Map<string, number> {
  const lawIdsByCategory = new Map<string, Set<string>>();

  const add = (categoryId: string, lawId: string) => {
    if (!categoryId || !lawId) return;
    let set = lawIdsByCategory.get(categoryId);
    if (!set) {
      set = new Set();
      lawIdsByCategory.set(categoryId, set);
    }
    set.add(lawId);
  };

  for (const row of junctionRows) {
    add(row.category_id, row.law_id);
  }
  for (const row of primaryRows) {
    if (row.category_id) add(row.category_id, row.id);
  }

  const counts = new Map<string, number>();
  for (const [categoryId, set] of lawIdsByCategory) {
    counts.set(categoryId, set.size);
  }
  return counts;
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const [categoriesRes, junctionRes, primaryRes] = await Promise.all([
      db.from("categories").select("id,name,slug,created_at").order("name"),
      db.from("law_categories").select("category_id,law_id"),
      db.from("laws").select("id,category_id").not("category_id", "is", null),
    ]);

    if (categoriesRes.error) {
      return NextResponse.json({ error: categoriesRes.error.message }, { status: 500 });
    }
    if (junctionRes.error) {
      return NextResponse.json({ error: junctionRes.error.message }, { status: 500 });
    }
    if (primaryRes.error) {
      return NextResponse.json({ error: primaryRes.error.message }, { status: 500 });
    }

    const lawCounts = countLawsPerCategory(
      (junctionRes.data ?? []) as Array<{ category_id: string; law_id: string }>,
      (primaryRes.data ?? []) as Array<{ id: string; category_id: string | null }>
    );

    const categories = (
      (categoriesRes.data ?? []) as Array<{
        id: string;
        name: string;
        slug: string | null;
        created_at: string;
      }>
    ).map((c) => ({
      ...c,
      lawCount: lawCounts.get(c.id) ?? 0,
    }));

    return NextResponse.json({ categories });
  } catch (err) {
    console.error("Admin categories GET error:", err);
    return NextResponse.json({ error: "Failed to load categories." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

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

    const { data: existing } = await db
      .from("categories")
      .select("id,name")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json(
        { error: "Category already exists.", category: existing },
        { status: 409 }
      );
    }

    const slug = slugifyCategoryName(name) || null;
    const { data, error } = await db
      .from("categories")
      .insert({ name, slug })
      .select("id,name,slug")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create category." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, category: data });
  } catch (err) {
    console.error("Admin categories POST error:", err);
    return NextResponse.json({ error: "Failed to create category." }, { status: 500 });
  }
}
