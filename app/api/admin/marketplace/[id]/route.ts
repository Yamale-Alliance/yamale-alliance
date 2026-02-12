import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import type { Database } from "@/lib/database.types";

type Update = Database["public"]["Tables"]["marketplace_items"]["Update"];
const VALID_TYPES = ["book", "course", "template"] as const;

/** GET: single item (admin) */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("marketplace_items")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json({ item: data });
}

/** PUT: update marketplace item */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const body = await request.json();
    const {
      type,
      title,
      author,
      description,
      price_cents,
      currency,
      image_url,
      published,
      sort_order,
      file_path,
      file_name,
      file_format,
    } = body;

    const updates: Update = {};
    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) {
        return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
      }
      updates.type = type;
    }
    if (typeof title === "string") updates.title = title.trim();
    if (author !== undefined) updates.author = typeof author === "string" ? author.trim() : "";
    if (description !== undefined) updates.description = description === "" ? null : description;
    if (typeof price_cents === "number") updates.price_cents = Math.max(0, Math.round(price_cents));
    if (typeof currency === "string" && currency) updates.currency = currency;
    if (image_url !== undefined) updates.image_url = image_url || null;
    if (typeof published === "boolean") updates.published = published;
    if (typeof sort_order === "number") updates.sort_order = sort_order;
    if (file_path !== undefined) updates.file_path = file_path || null;
    if (file_name !== undefined) updates.file_name = file_name || null;
    if (file_format !== undefined) updates.file_format = file_format || null;
    updates.updated_at = new Date().toISOString();

    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("marketplace_items") as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "marketplace_item.update",
      entityType: "marketplace_item",
      entityId: id,
      details: { title: data?.title },
    });

    return NextResponse.json({ item: data });
  } catch (err) {
    console.error("Admin marketplace PUT error:", err);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

/** DELETE: remove marketplace item */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const supabase = getSupabaseServer();
  const { error } = await supabase.from("marketplace_items").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, {
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "marketplace_item.delete",
    entityType: "marketplace_item",
    entityId: id,
    details: {},
  });

  return NextResponse.json({ ok: true });
}
