import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { recordAuditLog } from "@/lib/admin-audit";

/** GET: list all marketplace purchases (admin) with basic item info. */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("marketplace_purchases")
      .select(
        `
        id,
        user_id,
        marketplace_item_id,
        created_at,
        marketplace_items (
          title
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin marketplace purchases GET error:", error);
      return NextResponse.json({ error: "Failed to load purchases" }, { status: 500 });
    }

    const purchases = (data ?? []).map((row: any) => ({
      id: row.id as string,
      user_id: row.user_id as string,
      marketplace_item_id: row.marketplace_item_id as string,
      created_at: row.created_at as string,
      item_title: row.marketplace_items?.title ?? "(deleted item)",
    }));

    return NextResponse.json({ purchases });
  } catch (err) {
    console.error("Admin marketplace purchases GET error:", err);
    return NextResponse.json({ error: "Failed to load purchases" }, { status: 500 });
  }
}

/** DELETE: revoke a purchase by id so the user can buy again. */
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await (supabase.from("marketplace_purchases") as any)
      .delete()
      .eq("id", id)
      .select("user_id, marketplace_item_id")
      .maybeSingle();

    if (error) {
      console.error("Admin marketplace purchases DELETE error:", error);
      return NextResponse.json({ error: "Failed to revoke purchase" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "marketplace_purchase.delete",
      entityType: "marketplace_purchase",
      entityId: id,
      details: {
        user_id: data.user_id,
        marketplace_item_id: data.marketplace_item_id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin marketplace purchases DELETE error:", err);
    return NextResponse.json({ error: "Failed to revoke purchase" }, { status: 500 });
  }
}

