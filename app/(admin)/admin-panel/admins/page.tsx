"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { UserPlus, History, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

type AuditEntry = {
  id: string;
  admin_id: string;
  admin_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};
type AuditAdmin = { id: string; email: string | null };

const AUDIT_ACTION_KEYS = [
  "law.add",
  "law.update",
  "law.delete",
  "law.delete_batch",
  "pricing.update",
  "user.tier",
  "admin.add",
  "admin.role",
  "lawyer.removed",
  "marketplace_item.add",
  "marketplace_item.update",
  "marketplace_item.delete",
] as const;

/** Map API action code (e.g. law.add) to nested next-intl key under auditActions. */
function auditActionMessageKey(action: string): string | null {
  const dot = action.indexOf(".");
  if (dot === -1) return null;
  return `auditActions.${action.slice(0, dot)}.${action.slice(dot + 1)}`;
}

export default function AdminAdminsPage() {
  const t = useTranslations("admin.admins");
  const tc = useTranslations("admin.common");
  const PAGE_SIZE = 25;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditFilter, setAuditFilter] = useState("");
  const [auditActionGroup, setAuditActionGroup] = useState("");
  const [auditAdminId, setAuditAdminId] = useState("");
  const [auditAdmins, setAuditAdmins] = useState<AuditAdmin[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);

  const auditActionLabel = (action: string) => {
    const key = auditActionMessageKey(action);
    if (key && (AUDIT_ACTION_KEYS as readonly string[]).includes(action)) {
      return t(key as "auditActions.law.add");
    }
    return action;
  };

  const fetchAuditLog = () => {
    setAuditLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String((auditPage - 1) * PAGE_SIZE));
    if (auditFilter) params.set("action", auditFilter);
    if (auditActionGroup) params.set("actionGroup", auditActionGroup);
    if (auditAdminId) params.set("adminId", auditAdminId);
    fetch(`${window.location.origin}/api/admin/audit-log?${params.toString()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setAuditLog(Array.isArray(data?.entries) ? data.entries : []);
        setAuditTotal(typeof data?.total === "number" ? data.total : 0);
        setAuditAdmins(Array.isArray(data?.admins) ? data.admins : []);
      })
      .catch(() => {
        setAuditLog([]);
        setAuditTotal(0);
        setAuditAdmins([]);
      })
      .finally(() => setAuditLoading(false));
  };

  useEffect(() => {
    fetchAuditLog();
  }, [auditFilter, auditActionGroup, auditAdminId, auditPage]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditFilter, auditActionGroup, auditAdminId]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(false);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setAddError(t("enterEmail"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/admins`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? tc("failedToUpdateRole"));
        setSubmitting(false);
        return;
      }
      setAddSuccess(true);
      setEmail("");
      setRole("admin");
      fetchAuditLog();
    } catch {
      setAddError(tc("networkError"));
    }
    setSubmitting(false);
  };

  const formatDate = (s: string) => {
    const d = new Date(s);
    return d.toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  };
  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / PAGE_SIZE));

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>

      {/* Add admin */}
      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <UserPlus className="h-5 w-5" />
          {t("addAdminTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("addAdminDesc")}</p>
        <form onSubmit={handleAddAdmin} className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label className="mb-1 block text-sm font-medium">{tc("email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1 block text-sm font-medium">{tc("role")}</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="admin">{tc("admin")}</option>
              <option value="user">{tc("user")}</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? tc("saving") : t("saveRole")}
          </button>
        </form>
        {addError && (
          <p className="mt-3 text-sm text-destructive">{addError}</p>
        )}
        {addSuccess && (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400">{t("roleUpdatedSuccess")}</p>
        )}
      </section>

      {/* Version control / Audit log */}
      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <History className="h-5 w-5" />
          {t("versionControl")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("versionControlDesc")}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={auditActionGroup}
            onChange={(e) => setAuditActionGroup(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t("allControls")}</option>
            <option value="create">{t("createControls")}</option>
            <option value="update">{t("updateControls")}</option>
            <option value="delete">{t("deleteControls")}</option>
            <option value="role">{t("roleControls")}</option>
          </select>
          <select
            value={auditFilter}
            onChange={(e) => setAuditFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t("allActions")}</option>
            {AUDIT_ACTION_KEYS.map((value) => (
              <option key={value} value={value}>
                {auditActionLabel(value)}
              </option>
            ))}
          </select>
          <select
            value={auditAdminId}
            onChange={(e) => setAuditAdminId(e.target.value)}
            className="min-w-[240px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t("allAdmins")}</option>
            {auditAdmins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email ?? a.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fetchAuditLog()}
            className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
          >
            {tc("refresh")}
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          {auditLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : auditLog.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("noAuditEntries")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">{tc("when")}</th>
                    <th className="text-left p-3 font-medium">{tc("admin")}</th>
                    <th className="text-left p-3 font-medium">{tc("action")}</th>
                    <th className="text-left p-3 font-medium">{tc("details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry) => (
                    <tr key={entry.id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="p-3">
                        <span className="font-medium">{entry.admin_email ?? entry.admin_id}</span>
                      </td>
                      <td className="p-3">
                        {auditActionLabel(entry.action)}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {entry.details && typeof entry.details === "object" && Object.keys(entry.details).length > 0
                          ? JSON.stringify(entry.details)
                          : entry.entity_id ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {auditTotal > 0
              ? tc("showingRange", {
                  start: (auditPage - 1) * PAGE_SIZE + 1,
                  end: Math.min(auditPage * PAGE_SIZE, auditTotal),
                  total: auditTotal,
                })
              : tc("noEntries")}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
              disabled={auditPage <= 1 || auditLoading}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {tc("previous")}
            </button>
            <span className="text-xs text-muted-foreground">
              {tc("pageOf", { page: auditPage, total: auditTotalPages })}
            </span>
            <button
              type="button"
              onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
              disabled={auditPage >= auditTotalPages || auditLoading}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              {tc("next")}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
