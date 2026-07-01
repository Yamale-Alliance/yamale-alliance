"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Gift, Download } from "lucide-react";
import {
  buildAdminPrintExportHtml,
  openAdminPrintExport,
  resolveAdminExportLogoDataUrl,
} from "@/lib/admin-print-export";

type UserRow = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  tier: string;
  role: string | null;
};

const TIER_VALUES = ["free", "basic", "pro", "team"] as const;
const ROLE_VALUES = ["user", "admin", "legal_admin"] as const;

export default function AdminUsersPage() {
  const t = useTranslations("admin.users");
  const tc = useTranslations("admin.common");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${window.location.origin}/api/admin/users`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const setTier = async (userId: string, tier: string) => {
    if (updating) return;
    setUpdating(userId);
    setError(null);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/users/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tc("failedToUpdate"));
        setUpdating(null);
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, tier } : u)));
    } catch {
      setError(tc("networkError"));
    }
    setUpdating(null);
  };

  const setRole = async (userId: string, role: string) => {
    if (updating) return;
    setUpdating(userId);
    setError(null);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/users/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tc("failedToUpdateRole"));
        setUpdating(null);
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch {
      setError(tc("networkError"));
    }
    setUpdating(null);
  };

  const exportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    setError(null);
    try {
      const logoDataUrl = await resolveAdminExportLogoDataUrl();
      const name = (u: UserRow) => [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
      const esc = (s: string) =>
        String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      const generated = new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const html = buildAdminPrintExportHtml({
        documentTitle: t("export.documentTitle"),
        reportTitle: t("export.reportTitle"),
        generatedLabel: t("export.generated", { date: generated }),
        footer: t("export.footer"),
        tagline: t("export.tagline"),
        logoDataUrl,
        summaryLabel: t("export.summary", { count: users.length }),
        tableHeadHtml: `<tr><th>${esc(tc("name"))}</th><th>${esc(tc("email"))}</th><th>${esc(tc("role"))}</th><th>${esc(tc("accessTier"))}</th></tr>`,
        tableBodyHtml: users
          .map(
            (u) =>
              `<tr><td>${esc(name(u))}</td><td>${esc(u.email ?? "—")}</td><td>${esc(u.role ?? "—")}</td><td>${esc(u.tier)}</td></tr>`
          )
          .join(""),
      });
      openAdminPrintExport(html);
    } catch (err) {
      if (err instanceof Error && err.message === "popup_blocked") {
        setError(tc("popupBlocked"));
      } else {
        setError(tc("networkError"));
      }
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>

      {!loading && users.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={exportingPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
          >
            {exportingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {tc("exportPdf")}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">{tc("user")}</th>
                  <th className="text-left p-3 font-medium">{tc("email")}</th>
                  <th className="text-left p-3 font-medium">{tc("role")}</th>
                  <th className="text-left p-3 font-medium">{tc("accessTier")}</th>
                  <th className="text-left p-3 font-medium">{tc("giftAccess")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border hover:bg-muted/30">
                    <td className="p-3">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">{u.email ?? "—"}</td>
                    <td className="p-3">
                      <select
                        value={u.role && (ROLE_VALUES as readonly string[]).includes(u.role) ? u.role : "user"}
                        onChange={(e) => setRole(u.id, e.target.value)}
                        disabled={updating === u.id}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        {ROLE_VALUES.map((value) => (
                          <option key={value} value={value}>
                            {t(`roleLabels.${value}`)}
                          </option>
                        ))}
                      </select>
                      {updating === u.id && (
                        <Loader2 className="inline-block h-4 w-4 ml-1 animate-spin text-muted-foreground" />
                      )}
                    </td>
                    <td className="p-3">
                      <span className="rounded bg-muted px-2 py-0.5 font-medium">{u.tier}</span>
                    </td>
                    <td className="p-3">
                      <select
                        value={u.tier}
                        onChange={(e) => setTier(u.id, e.target.value)}
                        disabled={updating === u.id}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        {TIER_VALUES.map((value) => (
                          <option key={value} value={value}>
                            {t(`tiers.${value}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              {t("noUsersFound")}
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1">
        <Gift className="h-3 w-3" />
        {t("giftAccessHint")}
      </p>
    </div>
  );
}
