import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { recordAuditLog } from "@/lib/admin-audit";

/** GET: list all marketplace purchases (admin) with basic item info and buyer name. */
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

    const rows = (data ?? []) as Array<{
      id: string;
      user_id: string;
      marketplace_item_id: string;
      created_at: string;
      marketplace_items?: { title?: string | null } | null;
    }>;

    // Fetch basic user info from Clerk so we can show names instead of raw user IDs
    const uniqueUserIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    const userNameMap = new Map<string, string>();
    try {
      if (uniqueUserIds.length > 0) {
        const clerk = await clerkClient();
        // Clerk Node SDK supports fetching users in parallel; keep it simple and loop
        await Promise.all(
          uniqueUserIds.map(async (userId) => {
            try {
              const user = await clerk.users.getUser(userId);
              const name =
                [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                (user.username ?? "") ||
                (user.emailAddresses?.[0]?.emailAddress ?? "") ||
                userId;
              userNameMap.set(userId, name);
            } catch {
              userNameMap.set(userId, userId);
            }
          })
        );
      }
    } catch (e) {
      console.error("Admin marketplace purchases: failed to fetch user names from Clerk", e);
    }

    const purchases = rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      buyer_name: userNameMap.get(row.user_id) ?? row.user_id,
      marketplace_item_id: row.marketplace_item_id,
      created_at: row.created_at,
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
      // Reuse existing marketplace_item.delete audit action for revoking purchases
      action: "marketplace_item.delete",
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

