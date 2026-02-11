import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin";

/**
 * POST: Clear day pass for a user (stored in Clerk, not DB).
 * Body: { clerk_user_id?: string }. If omitted, clears the current (admin) user's day pass.
 * Use this to reset "full access" after truncating lawyer_unlocks / lawyer_search_unlocks.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const body = await request.json().catch(() => ({}));
  const targetUserId = typeof body.clerk_user_id === "string" ? body.clerk_user_id.trim() : admin.userId;
  if (!targetUserId) {
    return NextResponse.json({ error: "clerk_user_id required or use as logged-in admin" }, { status: 400 });
  }

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(targetUserId);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const { day_pass_expires_at, day_pass_last_purchase_at, ...rest } = existing;
    await clerk.users.updateUserMetadata(targetUserId, { publicMetadata: rest });
    return NextResponse.json({ ok: true, message: "Day pass cleared", userId: targetUserId });
  } catch (err) {
    console.error("Clear day pass error:", err);
    return NextResponse.json({ error: "Failed to clear day pass" }, { status: 500 });
  }
}
