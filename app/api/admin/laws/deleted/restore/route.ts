import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import type { Database } from "@/lib/database.types";

type DeletedLawRow = Database["public"]["Tables"]["deleted_laws"]["Row"];

/** POST: restore a law from deleted_laws back into laws. Body: { id: string } */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("deleted_laws") as any)
      .select(
        "id, country_id, applies_to_all_countries, category_id, title, source_url, source_name, year, status, content, content_plain, metadata, created_at, updated_at"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Deleted law not found" }, { status: 404 });
    }

    const row = data as DeletedLawRow;

    // Try re-inserting into laws; use the same id.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertErr } = await (supabase.from("laws") as any).insert({
      id: row.id,
      country_id: row.country_id,
      applies_to_all_countries: row.applies_to_all_countries,
      category_id: row.category_id,
      title: row.title,
      source_url: row.source_url,
      source_name: row.source_name,
      year: row.year,
      status: row.status,
      content: row.content,
      content_plain: row.content_plain,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });

    if (insertErr) {
      console.error("Restore law insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to restore law", details: insertErr.message },
        { status: 500 }
      );
    }

    // Remove from archive table.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: delErr } = await (supabase.from("deleted_laws") as any).delete().eq("id", row.id);
    if (delErr) {
      console.error("Restore law delete-from-archive error:", delErr);
      return NextResponse.json(
        { error: "Law restored, but failed to clean up archive entry", details: delErr.message },
        { status: 500 }
      );
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      // Reuse existing audit action type so AuditAction stays valid.
      action: "law.update",
      entityType: "law",
      entityId: row.id,
      details: { title: row.title, restored: true },
    });

    return NextResponse.json({ ok: true, lawId: row.id, title: row.title });
  } catch (err) {
    console.error("Admin restore deleted law error:", err);
    return NextResponse.json({ error: "Failed to restore law" }, { status: 500 });
  }
}

