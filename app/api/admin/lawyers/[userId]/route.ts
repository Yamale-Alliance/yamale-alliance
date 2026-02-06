import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin";
import { setSubmissionStatus } from "@/lib/lawyer-submissions";
import { recordAuditLog } from "@/lib/admin-audit";
import { getSupabaseServer } from "@/lib/supabase/server";

const VALID_STATUSES = ["approved", "rejected"] as const;

/** PATCH: approve or reject a lawyer application. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const status = body.status as string | undefined;
  if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...existing,
        status,
      },
    });
    setSubmissionStatus(userId, status as "approved" | "rejected");

    const supabase = getSupabaseServer();
    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "user.tier",
      entityType: "lawyer",
      entityId: userId,
      details: {
        lawyerStatus: status,
        targetEmail: user.emailAddresses[0]?.emailAddress,
      },
    });

    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error("Admin lawyer PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update lawyer status" },
      { status: 500 }
    );
  }
}

/** DELETE: remove lawyer from directory (reject + delete profile so they no longer appear). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const existing = (user.publicMetadata ?? {}) as Record<string, unknown>;
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...existing,
        status: "rejected",
      },
    });
    setSubmissionStatus(userId, "rejected");

    const supabase = getSupabaseServer();
    await supabase.from("lawyer_profiles").delete().eq("user_id", userId);
    await recordAuditLog(supabase, {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "lawyer.removed",
      entityType: "lawyer",
      entityId: userId,
      details: {
        targetEmail: user.emailAddresses[0]?.emailAddress,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin lawyer DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to remove lawyer" },
      { status: 500 }
    );
  }
}
