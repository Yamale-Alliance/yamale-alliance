"use client";

import { useState, useEffect } from "react";
import { Loader2, Gift, Download } from "lucide-react";

type UserRow = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  tier: string;
  role: string | null;
};

const TIER_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "basic", label: "Basic (10 AI/mo)" },
  { value: "pro", label: "Pro (50 AI/mo)" },
  { value: "team", label: "Team (unlimited AI)" },
];

const ROLE_OPTIONS = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
];
const VALID_ROLES = ROLE_OPTIONS.map((o) => o.value);

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
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
        setError(data.error ?? "Failed to update");
        setUpdating(null);
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, tier } : u)));
    } catch {
      setError("Network error");
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
        setError(data.error ?? "Failed to update role");
        setUpdating(null);
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch {
      setError("Network error");
    }
    setUpdating(null);
  };

  const exportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Popup blocked. Allow popups to export PDF.");
      return;
    }
    const name = (u: UserRow) => [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
    const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const generated = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Users export – Yamalé Alliance</title>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; margin: 0; padding: 32px 40px; color: #1a1a1a; font-size: 14px; }
        .header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
        .company { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #0f172a; }
        .tagline { font-size: 12px; color: #64748b; margin-top: 2px; }
        .report-title { font-size: 18px; font-weight: 600; margin: 0 0 4px 0; color: #0f172a; }
        .report-meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 10px 14px; text-align: left; border: 1px solid #e2e8f0; }
        th { background: #0f172a; color: #fff; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
        tr:nth-child(even) { background: #f8fafc; }
        tr:hover { background: #f1f5f9; }
        .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; }
      </style>
      </head><body>
      <div class="header">
        <div class="company">Yamalé Alliance</div>
        <div class="tagline">AI legal search & research platform</div>
      </div>
      <h1 class="report-title">Users export</h1>
      <p class="report-meta">Generated ${esc(generated)}</p>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Access tier</th></tr></thead>
        <tbody>
          ${users.map((u) => `<tr><td>${esc(name(u))}</td><td>${esc(u.email ?? "—")}</td><td>${esc(u.role ?? "—")}</td><td>${esc(u.tier)}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="footer">Yamalé Alliance – Confidential. This report was generated from the admin panel.</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">User Management</h1>
      <p className="mt-1 text-muted-foreground">
        Manage users and gift access to AI and other features by setting their plan tier. Change role in the table.
      </p>

      {!loading && users.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            Export PDF
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
                  <th className="text-left p-3 font-medium">User</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-left p-3 font-medium">Access tier</th>
                  <th className="text-left p-3 font-medium">Gift access</th>
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
                        value={u.role && VALID_ROLES.includes(u.role) ? u.role : "user"}
                        onChange={(e) => setRole(u.id, e.target.value)}
                        disabled={updating === u.id}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
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
                        {TIER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
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
              No users found.
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1">
        <Gift className="h-3 w-3" />
        Setting a tier (Basic, Pro, Plus, Team) grants that user access to AI research and other plan features without payment.
      </p>
    </div>
  );
}
