"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";

type SecuritySettingsResponse = {
  mfaIdleTimeoutSec: number | null;
  updatedAt: string | null;
  defaultIdleTimeoutSec: number;
  presets: Array<number | null>;
};

const NEVER_VALUE = "never";

function toSelectValue(sec: number | null): string {
  return sec === null ? NEVER_VALUE : String(sec);
}

export function AdminSecuritySettingsPanel() {
  const t = useTranslations("admin.security");
  const tc = useTranslations("admin.common");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [presets, setPresets] = useState<Array<number | null>>([]);
  const [selected, setSelected] = useState<string>(NEVER_VALUE);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/security-settings", { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t("errors.load"));
        return;
      }
      const data = (await res.json()) as SecuritySettingsResponse;
      setPresets(data.presets);
      setSelected(toSelectValue(data.mfaIdleTimeoutSec));
    } catch {
      setError(tc("networkError"));
    } finally {
      setLoading(false);
    }
  }, [t, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const isNever = selected === NEVER_VALUE;

  const save = async () => {
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch("/api/admin/security-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mfaIdleTimeoutSec: isNever ? null : Number.parseInt(selected, 10),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t("errors.save"));
        return;
      }
      setSavedAt(Date.now());
    } catch {
      setError(tc("networkError"));
    } finally {
      setSaving(false);
    }
  };

  function optionLabel(sec: number | null): string {
    if (sec === null) return t("timeout.never");
    if (sec % 3600 === 0) return t("timeout.hours", { count: sec / 3600 });
    return t("timeout.minutes", { count: Math.round(sec / 60) });
  }

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        {tc("loading")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-foreground" htmlFor="mfa-idle-timeout">
            {t("timeout.label")}
          </label>
          <select
            id="mfa-idle-timeout"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          >
            {presets.map((sec) => (
              <option key={toSelectValue(sec)} value={toSelectValue(sec)}>
                {optionLabel(sec)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t("timeout.hint")}</p>

          {isNever && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{t("timeout.neverWarning")}</span>
            </div>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {savedAt && !error && (
          <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">{t("saved")}</p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {tc("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
