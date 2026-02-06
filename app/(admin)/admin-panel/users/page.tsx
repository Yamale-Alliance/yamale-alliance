"use client";

import { useState, useEffect } from "react";
import { Loader2, Gift } from "lucide-react";

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

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">User Management</h1>
      <p className="mt-1 text-muted-foreground">
        Manage users and gift access to AI and other features by setting their plan tier.
      </p>

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
                    <td className="p-3">{u.role ?? "—"}</td>
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
                      {updating === u.id && (
                        <Loader2 className="inline-block h-4 w-4 ml-1 animate-spin text-muted-foreground" />
                      )}
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
