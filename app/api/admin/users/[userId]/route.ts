import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";

const VALID_TIERS = ["free", "basic", "pro", "team"];
const VALID_ROLES = ["admin", "user"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const tier = body.tier as string | undefined;
    const role = body.role as string | undefined;

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = { ...existing };

    if (tier !== undefined) {
      if (!VALID_TIERS.includes(tier)) {
        return NextResponse.json(
          { error: `Invalid tier. Use one of: ${VALID_TIERS.join(", ")}` },
          { status: 400 }
        );
      }
      updates.tier = tier;
    }

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json(
          { error: `Invalid role. Use one of: ${VALID_ROLES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.role = role;
    }

    if (tier === undefined && role === undefined) {
      return NextResponse.json({ error: "Provide tier or role to update" }, { status: 400 });
    }

    await clerk.users.updateUser(userId, {
      publicMetadata: updates,
    });

    const supabase = getSupabaseServer();
    if (tier !== undefined) {
      await recordAuditLog(supabase, {
        adminId: admin.userId,
        adminEmail: admin.email,
        action: "user.tier",
        entityType: "user",
        entityId: userId,
        details: { tier, targetEmail: user.emailAddresses[0]?.emailAddress },
      });
    }
    if (role !== undefined) {
      await recordAuditLog(supabase, {
        adminId: admin.userId,
        adminEmail: admin.email,
        action: "admin.role",
        entityType: "user",
        entityId: userId,
        details: { role, targetEmail: user.emailAddresses[0]?.emailAddress },
      });
    }

    return NextResponse.json({ ok: true, tier: updates.tier, role: updates.role });
  } catch (err) {
    console.error("Admin users PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
