import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  coerceIdleTimeoutInput,
  getAdminSecuritySettings,
  updateAdminMfaIdleTimeout,
  DEFAULT_MFA_IDLE_TIMEOUT_SEC,
  MFA_IDLE_TIMEOUT_PRESETS_SEC,
} from "@/lib/admin-security-settings";
import { getSupabaseServer } from "@/lib/supabase/server";
import { recordAuditLog } from "@/lib/admin-audit";

/** GET: current admin security settings (full admin only). */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const settings = await getAdminSecuritySettings();
  return NextResponse.json({
    mfaIdleTimeoutSec: settings.mfaIdleTimeoutSec,
    updatedAt: settings.updatedAt,
    defaultIdleTimeoutSec: DEFAULT_MFA_IDLE_TIMEOUT_SEC,
    presets: MFA_IDLE_TIMEOUT_PRESETS_SEC,
  });
}

/** PUT: update the MFA step-up idle timeout (full admin only). */
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.mfaIdleTimeoutSec;
  const idleTimeoutSec = coerceIdleTimeoutInput(raw);

  const result = await updateAdminMfaIdleTimeout(idleTimeoutSec, admin.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  await recordAuditLog(getSupabaseServer(), {
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "admin.security.mfa_idle_timeout",
    entityType: "admin_security_settings",
    entityId: "main",
    details: { mfaIdleTimeoutSec: idleTimeoutSec },
  });

  return NextResponse.json({ ok: true, mfaIdleTimeoutSec: idleTimeoutSec });
}
