"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck, Smartphone } from "lucide-react";

type MfaStatus = {
  enforced: boolean;
  enrolled: boolean;
  stepUpComplete: boolean;
};

type EnrollPayload = {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
};

function safeAdminReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/admin-panel";
  if (!raw.startsWith("/admin-panel")) return "/admin-panel";
  if (raw === "/admin-panel/mfa" || raw.startsWith("/admin-panel/mfa/")) return "/admin-panel";
  return raw;
}

function goToAdminReturnTo(returnTo: string) {
  window.location.assign(returnTo);
}

export function AdminMfaPanel() {
  const searchParams = useSearchParams();
  const returnTo = safeAdminReturnTo(searchParams.get("returnTo"));

  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enroll, setEnroll] = useState<EnrollPayload | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoEnrollStarted = useRef(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mfa", { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Unable to load MFA status");
        return;
      }
      const data = (await res.json()) as MfaStatus;
      setStatus(data);
      if (data.stepUpComplete && data.enrolled) {
        goToAdminReturnTo(returnTo);
        return;
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [returnTo]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const startEnroll = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mfa", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enroll" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Enrollment failed");
        return;
      }
      setEnroll(data as EnrollPayload);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }, []);

  const redirectedFromAdmin = searchParams.has("returnTo");

  useEffect(() => {
    if (!status || status.enrolled || enroll || autoEnrollStarted.current) return;
    if (status.enforced || redirectedFromAdmin) {
      autoEnrollStarted.current = true;
      void startEnroll();
    }
  }, [status, enroll, redirectedFromAdmin, startEnroll]);

  const submitCode = async (action: "confirm-enroll" | "verify") => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mfa", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, code }),
      });
      let data: { error?: string; lockoutSec?: number } = {};
      try {
        data = (await res.json()) as { error?: string; lockoutSec?: number };
      } catch {
        setError(res.ok ? "Unexpected server response" : `Verification failed (${res.status})`);
        return;
      }
      if (!res.ok) {
        if (data.lockoutSec) {
          setError(`Too many attempts. Try again in ${Math.ceil(data.lockoutSec / 60)} minutes.`);
        } else {
          setError(data.error ?? "Verification failed");
        }
        return;
      }
      goToAdminReturnTo(returnTo);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Loading…
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6">
        <p className="text-destructive">{error ?? "Unable to load MFA settings."}</p>
      </div>
    );
  }

  const needsEnrollment = !status.enrolled;
  const needsVerify = status.enrolled && !status.stepUpComplete;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card px-5 py-8 shadow-sm sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Admin second factor</h1>
            <p className="text-sm text-muted-foreground">
              {needsEnrollment
                ? redirectedFromAdmin
                  ? "Before you can use the admin panel, set up an authenticator app."
                  : "Set up an authenticator app before using the admin panel."
                : "Enter the 6-digit code from your authenticator app."}
            </p>
          </div>
        </div>

        {status.enforced && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Admin MFA is enforced on this environment. You must complete this step to continue.
          </p>
        )}

        {needsEnrollment && !enroll && (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Smartphone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p>
                Use Google Authenticator, 1Password, Authy, or any TOTP app. Scan the QR code and
                confirm with a one-time code.
              </p>
            </div>
            {submitting ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Preparing your authenticator setup…
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void startEnroll()}
                className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Set up authenticator
              </button>
            )}
          </div>
        )}

        {needsEnrollment && enroll && (
          <div className="mt-6 space-y-4">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enroll.qrDataUrl} alt="Authenticator QR code" className="rounded-lg border border-border" />
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs">
              <p className="font-medium text-foreground">Manual entry key</p>
              <p className="mt-1 break-all font-mono text-muted-foreground">{enroll.secret}</p>
            </div>
            <label className="block text-sm font-medium">
              Confirmation code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-center text-lg tracking-widest"
                placeholder="000000"
              />
            </label>
            <button
              type="button"
              disabled={submitting || code.length !== 6}
              onClick={() => void submitCode("confirm-enroll")}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm and continue"}
            </button>
          </div>
        )}

        {needsVerify && (
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Authenticator code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-center text-lg tracking-widest"
                placeholder="000000"
              />
            </label>
            <button
              type="button"
              disabled={submitting || code.length !== 6}
              onClick={() => void submitCode("verify")}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify and continue"}
            </button>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
