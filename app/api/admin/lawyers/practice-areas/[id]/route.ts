import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  canonicalExpertiseLabel,
  expertiseSegmentKey,
} from "@/lib/lawyer-expertise";
import {
  countLawyersUsingPracticeArea,
  fetchLawyerExpertiseRows,
  replacePracticeAreaInLawyers,
  validateCatalogName,
} from "@/lib/lawyer-catalog-server";
import { getSupabaseServer } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Practice area id is required." }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawName = typeof body?.name === "string" ? body.name : "";
    const validated = validateCatalogName(rawName);
    if (!validated) {
      return NextResponse.json({ error: "Practice area name is too short." }, { status: 400 });
    }
    const name = canonicalExpertiseLabel(validated);

    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: current, error: currentErr } = await db
      .from("lawyer_practice_areas")
      .select("id,name")
      .eq("id", id)
      .maybeSingle();

    if (currentErr) {
      return NextResponse.json({ error: currentErr.message }, { status: 500 });
    }
    if (!current?.id) {
      return NextResponse.json({ error: "Practice area not found." }, { status: 404 });
    }

    const oldName = canonicalExpertiseLabel(current.name);
    if (expertiseSegmentKey(oldName) === expertiseSegmentKey(name)) {
      return NextResponse.json({ ok: true, practiceArea: { ...current, name: oldName } });
    }

    const { data: duplicate } = await db
      .from("lawyer_practice_areas")
      .select("id,name")
      .ilike("name", name)
      .neq("id", id)
      .limit(1)
      .maybeSingle();

    if (duplicate?.id) {
      return NextResponse.json(
        { error: "Another practice area already uses this name.", practiceArea: duplicate },
        { status: 409 }
      );
    }

    const { data, error } = await db
      .from("lawyer_practice_areas")
      .update({ name })
      .eq("id", id)
      .select("id,name,sort_order,created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to update practice area." },
        { status: 500 }
      );
    }

    await replacePracticeAreaInLawyers(oldName, name);

    const lawyers = await fetchLawyerExpertiseRows();
    return NextResponse.json({
      ok: true,
      practiceArea: {
        ...data,
        name: canonicalExpertiseLabel(data.name),
        usageCount: countLawyersUsingPracticeArea(lawyers, data.name),
      },
    });
  } catch (err) {
    console.error("Admin lawyer practice areas PATCH error:", err);
    return NextResponse.json({ error: "Failed to update practice area." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Practice area id is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: current, error: currentErr } = await db
      .from("lawyer_practice_areas")
      .select("id,name")
      .eq("id", id)
      .maybeSingle();

    if (currentErr) {
      return NextResponse.json({ error: currentErr.message }, { status: 500 });
    }
    if (!current?.id) {
      return NextResponse.json({ error: "Practice area not found." }, { status: 404 });
    }

    const lawyers = await fetchLawyerExpertiseRows();
    const usageCount = countLawyersUsingPracticeArea(lawyers, current.name);
    if (usageCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete: ${usageCount} lawyer(s) use this practice area.`,
          usageCount,
        },
        { status: 409 }
      );
    }

    const { error } = await db.from("lawyer_practice_areas").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin lawyer practice areas DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete practice area." }, { status: 500 });
  }
}
