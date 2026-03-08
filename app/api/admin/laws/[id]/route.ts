import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import type { Database } from "@/lib/database.types";

type LawRow = Database["public"]["Tables"]["laws"]["Row"];

/** GET: fetch a single law for admin editing (including full text). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing law id" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("laws")
      .select(
        "id, title, country_id, category_id, year, status, source_url, source_name, content, content_plain"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Law not found" }, { status: 404 });
    }

    const law = data as LawRow;
    return NextResponse.json({ law });
  } catch (err) {
    console.error("Admin law GET error:", err);
    return NextResponse.json({ error: "Failed to load law" }, { status: 500 });
  }
}

/** PUT: update law metadata (title, country, category, year, status, source) and/or content. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing law id" }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseServer();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (!t) {
        return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
      }
      updates.title = t;
    }
    if (body.country_id !== undefined) updates.country_id = body.country_id || null;
    if (body.category_id !== undefined) updates.category_id = body.category_id || null;
    if (body.year !== undefined) updates.year = body.year ? Number(body.year) : null;
    if (typeof body.status === "string") updates.status = body.status.trim() || "In force";
    if (typeof body.source_url === "string") updates.source_url = body.source_url.trim() || null;
    if (typeof body.source_name === "string") updates.source_name = body.source_name.trim() || null;

    if (typeof body.content === "string") {
      const trimmed = body.content.trim() || null;
      updates.content = trimmed;
      updates.content_plain = trimmed;
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("laws") as any)
      .update(updates)
      .eq("id", id)
      .select("id, title, country_id, category_id, year, status, source_url, source_name")
      .single();

    if (error) {
      console.error("Admin law PUT error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "law.update",
      entityType: "law",
      entityId: id,
      details: { fields: Object.keys(updates).filter((k) => k !== "updated_at"), title: data?.title },
    });

    return NextResponse.json({ ok: true, law: data });
  } catch (err) {
    console.error("Admin law PUT error:", err);
    return NextResponse.json({ error: "Failed to update law" }, { status: 500 });
  }
}

/** DELETE: remove a law from the database (admin only). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing law id" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const { data: existing, error: fetchError } = await supabase
      .from("laws")
      .select("id, title")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Law not found" }, { status: 404 });
    }

    const existingLaw = existing as { id: string; title: string };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase.from("laws") as any)
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Admin law DELETE error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "law.delete",
      entityType: "law",
      entityId: id,
      details: { title: existingLaw.title },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin law DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete law" }, { status: 500 });
  }
}

