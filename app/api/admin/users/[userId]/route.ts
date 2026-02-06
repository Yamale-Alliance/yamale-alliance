import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";

const VALID_TIERS = ["free", "basic", "pro", "plus", "team"];

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
    if (!tier || !VALID_TIERS.includes(tier)) {
      return NextResponse.json(
        { error: `Invalid tier. Use one of: ${VALID_TIERS.join(", ")}` },
        { status: 400 }
      );
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    await clerk.users.updateUser(userId, {
      publicMetadata: { ...existing, tier },
    });

    const supabase = getSupabaseServer();
    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "user.tier",
      entityType: "user",
      entityId: userId,
      details: { tier, targetEmail: user.emailAddresses[0]?.emailAddress },
    });

    return NextResponse.json({ ok: true, tier });
  } catch (err) {
    console.error("Admin users PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
