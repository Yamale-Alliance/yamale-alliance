import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";
import { recordMarketplaceCartPurchases } from "@/lib/marketplace-cart-purchases";
import { parseItemPackConfig } from "@/lib/marketplace-item-packs";
import { getSupabaseServer } from "@/lib/supabase/server";

async function resolveClerkUserId(params: {
  userId?: string;
  email?: string;
}): Promise<{ userId: string; email: string | null; displayName: string } | { error: string }> {
  const clerk = await clerkClient();
  const userId = params.userId?.trim() ?? "";
  const email = params.email?.trim().toLowerCase() ?? "";

  if (userId) {
    try {
      const user = await clerk.users.getUser(userId);
      const resolvedEmail = user.emailAddresses?.[0]?.emailAddress ?? null;
      const displayName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.username ||
        resolvedEmail ||
        user.id;
      return { userId: user.id, email: resolvedEmail, displayName };
    } catch {
      return { error: "User not found for that Clerk user ID." };
    }
  }

  if (email) {
    const { data: users } = await clerk.users.getUserList({
      emailAddress: [email],
      limit: 5,
    });
    const user = users?.[0];
    if (!user) {
      return { error: "No Clerk user found with that email." };
    }
    const resolvedEmail = user.emailAddresses?.[0]?.emailAddress ?? email;
    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      resolvedEmail ||
      user.id;
    return { userId: user.id, email: resolvedEmail, displayName };
  }

  return { error: "Provide a Clerk user ID or email." };
}

function packMemberIds(anchorId: string, partnerIds: string[]): string[] {
  return Array.from(new Set([anchorId, ...partnerIds.filter(Boolean)]));
}

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

    const uniqueUserIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    const userNameMap = new Map<string, string>();
    try {
      if (uniqueUserIds.length > 0) {
        const clerk = await clerkClient();
        await Promise.all(
          uniqueUserIds.map(async (uid) => {
            try {
              const user = await clerk.users.getUser(uid);
              const name =
                [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                (user.username ?? "") ||
                (user.emailAddresses?.[0]?.emailAddress ?? "") ||
                uid;
              userNameMap.set(uid, name);
            } catch {
              userNameMap.set(uid, uid);
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

/**
 * POST: grant complimentary Vault access to a user (no payment).
 * Body: { marketplaceItemId, userId? | email?, reason?, includePackPartners? }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
    }

    const marketplaceItemId =
      typeof body.marketplaceItemId === "string" ? body.marketplaceItemId.trim() : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    const includePackPartners = body.includePackPartners !== false;

    if (!marketplaceItemId) {
      return NextResponse.json({ error: "marketplaceItemId is required" }, { status: 400 });
    }

    const resolved = await resolveClerkUserId({ userId: userId || undefined, email: email || undefined });
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 404 });
    }

    const supabase = getSupabaseServer();
    const { data: item, error: itemError } = await supabase
      .from("marketplace_items")
      .select("id, title, item_pack")
      .eq("id", marketplaceItemId)
      .maybeSingle();

    if (itemError) {
      console.error("Admin marketplace grant: item lookup failed", itemError);
      return NextResponse.json({ error: "Failed to look up vault item" }, { status: 500 });
    }
    if (!item) {
      return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    }

    const itemRow = item as { id: string; title: string; item_pack: unknown };
    let itemIds = [itemRow.id];
    if (includePackPartners) {
      const pack = parseItemPackConfig(itemRow.item_pack);
      if (pack?.partner_item_ids?.length) {
        itemIds = packMemberIds(itemRow.id, pack.partner_item_ids);
      }
    }

    const sessionId = `admin_grant:${admin.userId}:${Date.now()}`;
    await recordMarketplaceCartPurchases({
      userId: resolved.userId,
      itemIds,
      sessionId,
    });

    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "marketplace_purchase.grant",
      entityType: "marketplace_purchase",
      entityId: marketplaceItemId,
      details: {
        user_id: resolved.userId,
        user_email: resolved.email,
        marketplace_item_id: marketplaceItemId,
        item_ids: itemIds,
        item_title: itemRow.title,
        reason: reason || null,
        complimentary: true,
      },
    });

    return NextResponse.json({
      ok: true,
      userId: resolved.userId,
      buyerName: resolved.displayName,
      email: resolved.email,
      itemIds,
      itemTitle: itemRow.title,
    });
  } catch (err) {
    console.error("Admin marketplace purchases POST error:", err);
    return NextResponse.json({ error: "Failed to grant access" }, { status: 500 });
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
      action: "marketplace_purchase.revoke",
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
