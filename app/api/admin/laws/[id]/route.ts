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
        "id, title, country_id, category_id, year, status, content, content_plain"
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

/** PUT: update law text (content/content_plain) for typo fixes and corrections. */
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
    const content = typeof body.content === "string" ? body.content : null;
    if (content === null) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const trimmed = content.trim() || null;
    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("laws") as any)
      .update({
        content: trimmed,
        content_plain: trimmed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, title")
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
      details: { fields: ["content", "content_plain"], title: data?.title },
    });

    return NextResponse.json({ ok: true, law: data });
  } catch (err) {
    console.error("Admin law PUT error:", err);
    return NextResponse.json({ error: "Failed to update law" }, { status: 500 });
  }
}

