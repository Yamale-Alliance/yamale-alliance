import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { recordAuditLog } from "@/lib/admin-audit";

const ALLOWED_ROLES = ["admin", "user", "lawyer"];

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role.toLowerCase() : "";

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Role must be one of: ${ALLOWED_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    const clerk = await clerkClient();
    const { data: users } = await clerk.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });

    const user = users?.[0];
    if (!user) {
      return NextResponse.json(
        { error: "No user found with that email. They must sign up first." },
        { status: 404 }
      );
    }

    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    await clerk.users.updateUser(user.id, {
      publicMetadata: { ...existing, role },
    });

    const supabase = getSupabaseServer();
    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "admin.add",
      entityType: "user",
      entityId: user.id,
      details: { email, role, targetUserId: user.id },
    });

    return NextResponse.json({
      ok: true,
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress ?? email,
      role,
    });
  } catch (err) {
    console.error("Admin admins POST error:", err);
    return NextResponse.json(
      { error: "Failed to update user role" },
      { status: 500 }
    );
  }
}
