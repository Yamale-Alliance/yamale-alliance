"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Briefcase, Plus, Trash2, Download } from "lucide-react";

type LawyerRow = {
  id: string;
  name: string;
  country: string | null;
  expertise: string;
  email: string | null;
  phone: string | null;
  contacts: string | null;
  linkedin_url: string | null;
  source: string;
  approved: boolean;
  created_at: string;
};

export default function AdminLawyersPage() {
  const [lawyers, setLawyers] = useState<LawyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [formExpertise, setFormExpertise] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLinkedin, setFormLinkedin] = useState("");

  const fetchLawyers = () => {
    setLoading(true);
    fetch(`${window.location.origin}/api/admin/lawyers`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setLawyers(Array.isArray(data) ? data : []);
      })
      .catch(() => setLawyers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLawyers();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formExpertise.trim()) {
      setError("Name and expertise are required.");
      return;
    }
    if (!formEmail.trim() && !formPhone.trim()) {
      setError("Email or phone is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/lawyers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          country: formCountry.trim() || undefined,
          expertise: formExpertise.trim(),
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          linkedin_url: formLinkedin.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add lawyer");
        return;
      }
      setFormName("");
      setFormCountry("");
      setFormExpertise("");
      setFormEmail("");
      setFormPhone("");
      setFormLinkedin("");
      setShowForm(false);
      fetchLawyers();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (removingId || !confirm("Remove this lawyer from the directory? They will no longer appear on the Find a Lawyer page.")) return;
    setRemovingId(id);
    setError(null);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/lawyers/directory/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to remove");
        return;
      }
      setLawyers((prev) => prev.filter((l) => l.id !== id));
    } catch {
      setError("Network error");
    } finally {
      setRemovingId(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const exportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Popup blocked. Allow popups to export PDF.");
      return;
    }
    const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const generated = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Lawyers directory – Yamalé Alliance</title>
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
      <h1 class="report-title">Lawyers directory export</h1>
      <p class="report-meta">Generated ${esc(generated)}</p>
      <table>
        <thead><tr><th>Name</th><th>Country</th><th>Expertise</th><th>Email</th><th>Phone</th><th>Added</th></tr></thead>
        <tbody>
          ${lawyers.map((l) => `<tr><td>${esc(l.name)}</td><td>${esc(l.country ?? "—")}</td><td>${esc(l.expertise)}</td><td>${esc(l.email ?? "—")}</td><td>${esc(l.phone ?? "—")}</td><td>${esc(formatDate(l.created_at))}</td></tr>`).join("")}
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Lawyers directory
          </h1>
          <p className="mt-1 text-muted-foreground">
            Lawyers are added manually or via the public form. They appear on the Find a Lawyer page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lawyers.length > 0 && (
            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add lawyer
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleAddSubmit} className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Add lawyer to directory</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="admin-lawyer-name" className="block text-sm font-medium text-foreground mb-1">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                id="admin-lawyer-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                maxLength={200}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Full name"
              />
            </div>
            <div>
              <label htmlFor="admin-lawyer-country" className="block text-sm font-medium text-foreground mb-1">
                Country
              </label>
              <input
                id="admin-lawyer-country"
                type="text"
                value={formCountry}
                onChange={(e) => setFormCountry(e.target.value)}
                maxLength={100}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. Ghana, Kenya"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="admin-lawyer-expertise" className="block text-sm font-medium text-foreground mb-1">
                Expertise <span className="text-destructive">*</span>
              </label>
              <input
                id="admin-lawyer-expertise"
                type="text"
                value={formExpertise}
                onChange={(e) => setFormExpertise(e.target.value)}
                required
                maxLength={500}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. Corporate law, Tax, Employment"
              />
            </div>
            <div>
              <label htmlFor="admin-lawyer-email" className="block text-sm font-medium text-foreground mb-1">
                Email <span className="text-destructive">*</span>
              </label>
              <input
                id="admin-lawyer-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                maxLength={255}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="lawyer@example.com"
              />
            </div>
            <div>
              <label htmlFor="admin-lawyer-phone" className="block text-sm font-medium text-foreground mb-1">
                Phone
              </label>
              <input
                id="admin-lawyer-phone"
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                maxLength={50}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. +233 00 000 0000"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="admin-lawyer-linkedin" className="block text-sm font-medium text-foreground mb-1">
                LinkedIn URL <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="admin-lawyer-linkedin"
                type="url"
                value={formLinkedin}
                onChange={(e) => setFormLinkedin(e.target.value)}
                maxLength={500}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="https://linkedin.com/in/..."
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Adding…" : "Add lawyer"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Country</th>
                  <th className="text-left p-3 font-medium">Expertise</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Phone</th>
                  <th className="text-left p-3 font-medium">Source</th>
                  <th className="text-left p-3 font-medium">Added</th>
                  <th className="text-left p-3 font-medium w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lawyers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No lawyers in the directory yet. Add one manually or share the form link: /lawyers/join
                    </td>
                  </tr>
                ) : (
                  lawyers.map((l) => (
                    <tr key={l.id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3 font-medium">{l.name}</td>
                      <td className="p-3 text-muted-foreground">{l.country ?? "—"}</td>
                      <td className="p-3 max-w-[200px] truncate" title={l.expertise}>{l.expertise}</td>
                      <td className="p-3 max-w-[180px] truncate text-muted-foreground" title={l.email ?? ""}>
                        {l.email ?? "—"}
                      </td>
                      <td className="p-3 max-w-[140px] truncate text-muted-foreground" title={l.phone ?? ""}>
                        {l.phone ?? "—"}
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${l.source === "form" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
                          {l.source === "form" ? "Form" : "Manual"}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDate(l.created_at)}</td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => handleRemove(l.id)}
                          disabled={removingId === l.id}
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          title="Remove from directory"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Public form: <strong>/lawyers/join</strong> — lawyers can submit their details there to be added to the directory.
      </p>
    </div>
  );
}
