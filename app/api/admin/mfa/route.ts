import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/admin";
import { readAdminMfaGateState } from "@/lib/admin-mfa-gate";
import {
  adminHasConfirmedTotp,
  completeAdminTotpEnrollment,
  disableAdminTotp,
  startAdminTotpEnrollment,
  verifyAdminStepUpCode,
} from "@/lib/admin-mfa";
import { issueAdminStepUpCookie } from "@/lib/admin-mfa-gate";
import {
  ADMIN_MFA_COOKIE_NAME,
  adminMfaCookieSerializeOptions,
} from "@/lib/admin-mfa-session";
import { getSupabaseServer } from "@/lib/supabase/server";
import { recordAuditLog } from "@/lib/admin-audit";

const MFA_SKIP = { skipMfa: true as const };

export async function GET() {
  const admin = await requireAdmin(MFA_SKIP);
  if (admin instanceof NextResponse) return admin;

  const state = await readAdminMfaGateState(admin.userId);
  return NextResponse.json({
    enforced: state.enforced,
    enrolled: state.enrolled,
    stepUpComplete: state.stepUpComplete,
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(MFA_SKIP);
  if (admin instanceof NextResponse) return admin;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (action === "enroll") {
    if (await adminHasConfirmedTotp(admin.userId)) {
      return NextResponse.json({ error: "Authenticator already enrolled" }, { status: 409 });
    }

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress ?? admin.email ?? "admin";
    const enrollment = await startAdminTotpEnrollment(admin.userId, email);
    if (!enrollment) {
      return NextResponse.json({ error: "Failed to start enrollment" }, { status: 500 });
    }

    return NextResponse.json({
      secret: enrollment.secret,
      otpauthUrl: enrollment.otpauthUrl,
      qrDataUrl: enrollment.qrDataUrl,
    });
  }

  if (action === "confirm-enroll") {
    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }
    const result = await completeAdminTotpEnrollment(admin.userId, code);
    if (!result.ok) {
      if (result.reason === "locked") {
        return NextResponse.json(
          { error: "Too many attempts. Try again later.", lockoutSec: result.lockoutSec },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    let cookie: { name: string; value: string };
    try {
      cookie = await issueAdminStepUpCookie(admin.userId);
    } catch (err) {
      console.error("admin mfa confirm-enroll cookie:", err);
      return NextResponse.json(
        { error: "MFA session could not be started. Check ADMIN_MFA_SECRET is configured." },
        { status: 500 }
      );
    }
    const res = NextResponse.json({ ok: true, stepUpComplete: true });
    res.cookies.set(cookie.name, cookie.value, adminMfaCookieSerializeOptions());
    await recordAuditLog(getSupabaseServer(), {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "admin.mfa.enroll",
      entityType: "user",
      entityId: admin.userId,
      details: {},
    });
    return res;
  }

  if (action === "verify") {
    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }
    const result = await verifyAdminStepUpCode(admin.userId, code);
    if (!result.ok) {
      if (result.reason === "not_enrolled") {
        return NextResponse.json({ error: "Enrollment required", code: "MFA_ENROLLMENT_REQUIRED" }, { status: 403 });
      }
      if (result.reason === "locked") {
        return NextResponse.json(
          { error: "Too many attempts. Try again later.", lockoutSec: result.lockoutSec },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    let cookie: { name: string; value: string };
    try {
      cookie = await issueAdminStepUpCookie(admin.userId);
    } catch (err) {
      console.error("admin mfa verify cookie:", err);
      return NextResponse.json(
        { error: "MFA session could not be started. Check ADMIN_MFA_SECRET is configured." },
        { status: 500 }
      );
    }
    const res = NextResponse.json({ ok: true, stepUpComplete: true });
    res.cookies.set(cookie.name, cookie.value, adminMfaCookieSerializeOptions());
    return res;
  }

  if (action === "disable") {
    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }
    const result = await disableAdminTotp(admin.userId, code);
    if (!result.ok) {
      if (result.reason === "locked") {
        return NextResponse.json(
          { error: "Too many attempts. Try again later.", lockoutSec: result.lockoutSec },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_MFA_COOKIE_NAME, "", { ...adminMfaCookieSerializeOptions(0), maxAge: 0 });
    await recordAuditLog(getSupabaseServer(), {
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "admin.mfa.disable",
      entityType: "user",
      entityId: admin.userId,
      details: {},
    });
    return res;
  }

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_MFA_COOKIE_NAME, "", { ...adminMfaCookieSerializeOptions(0), maxAge: 0 });
    return res;
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
