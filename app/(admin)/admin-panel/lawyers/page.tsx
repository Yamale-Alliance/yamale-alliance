"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Loader2, Briefcase, Plus, Trash2, Download, Upload, Video, X } from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";
import { normalizeExpertiseField } from "@/lib/lawyer-expertise";
import { cloudinaryVideoPlaybackUrl } from "@/lib/cloudinary-video-playback";

type LawyerRow = {
  id: string;
  name: string;
  country: string | null;
  expertise: string;
  email: string | null;
  phone: string | null;
  contacts: string | null;
  linkedin_url: string | null;
  primary_language: string | null;
  other_languages: string | null;
  image_url: string | null;
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
  const { confirm, confirmDialog } = useConfirm();

  const [formName, setFormName] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [formExpertise, setFormExpertise] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPrimaryLanguage, setFormPrimaryLanguage] = useState("");
  const [formOtherLanguages, setFormOtherLanguages] = useState("");
  const [formLinkedin, setFormLinkedin] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formImageUploading, setFormImageUploading] = useState(false);

  const [editing, setEditing] = useState<LawyerRow | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editExpertise, setEditExpertise] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPrimaryLanguage, setEditPrimaryLanguage] = useState("");
  const [editOtherLanguages, setEditOtherLanguages] = useState("");
  const [editLinkedin, setEditLinkedin] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editImageUploading, setEditImageUploading] = useState(false);

  const [onboardingVideoUrl, setOnboardingVideoUrl] = useState<string | null>(null);
  const [onboardingVideoUploading, setOnboardingVideoUploading] = useState(false);
  const [onboardingVideoRemoving, setOnboardingVideoRemoving] = useState(false);

  const fetchOnboardingVideo = () => {
    fetch(`${window.location.origin}/api/admin/lawyers/onboarding-video`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { url?: string | null }) => {
        setOnboardingVideoUrl(data.url ?? null);
      })
      .catch(() => setOnboardingVideoUrl(null));
  };

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
    fetchOnboardingVideo();
  }, []);

  const handleOnboardingVideoUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".mp4") && file.type !== "video/mp4") {
      setError("Onboarding video must be an MP4 file");
      return;
    }
    const maxBytes = 100 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError("Video must be under 100 MB");
      return;
    }

    setOnboardingVideoUploading(true);
    setError(null);
    const origin = window.location.origin;

    try {
      const signRes = await fetch(`${origin}/api/admin/lawyers/onboarding-video/signature`, {
        credentials: "include",
      });
      const sign = await parseJsonSafe(signRes);
      if (!signRes.ok) {
        throw new Error(typeof sign.error === "string" ? sign.error : "Failed to prepare upload");
      }

      const cloudName = typeof sign.cloudName === "string" ? sign.cloudName : undefined;
      const apiKey = typeof sign.apiKey === "string" ? sign.apiKey : undefined;
      const timestamp = typeof sign.timestamp === "number" ? sign.timestamp : undefined;
      const signature = typeof sign.signature === "string" ? sign.signature : undefined;
      const folder = typeof sign.folder === "string" ? sign.folder : undefined;
      const publicId = typeof sign.publicId === "string" ? sign.publicId : undefined;

      if (!cloudName || !apiKey || !timestamp || !signature || !folder || !publicId) {
        throw new Error("Invalid upload signature from server");
      }

      const uploadForm = new FormData();
      uploadForm.append("file", file);
      uploadForm.append("api_key", apiKey);
      uploadForm.append("timestamp", String(timestamp));
      uploadForm.append("signature", signature);
      uploadForm.append("folder", folder);
      uploadForm.append("public_id", publicId);
      uploadForm.append("overwrite", "true");

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
        { method: "POST", body: uploadForm }
      );
      const cloudData = (await cloudRes.json()) as {
        secure_url?: string;
        public_id?: string;
        error?: { message?: string };
      };
      if (!cloudRes.ok) {
        throw new Error(cloudData.error?.message ?? "Cloudinary upload failed");
      }
      if (!cloudData.secure_url || !cloudData.public_id) {
        throw new Error("Cloudinary did not return a video URL");
      }

      const saveRes = await fetch(`${origin}/api/admin/lawyers/onboarding-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          secureUrl: cloudData.secure_url,
          publicId: cloudData.public_id,
        }),
      });
      const saveData = await parseJsonSafe(saveRes);
      if (!saveRes.ok) {
        throw new Error(typeof saveData.error === "string" ? saveData.error : "Failed to save video");
      }
      setOnboardingVideoUrl(
        typeof saveData.url === "string" ? saveData.url : cloudData.secure_url
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Video upload failed");
    } finally {
      setOnboardingVideoUploading(false);
    }
  };

  const handleOnboardingVideoRemove = async () => {
    const ok = await confirm({
      title: "Remove onboarding video?",
      description: "Visitors will no longer see the lawyers tab intro video until you upload a new one.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    setOnboardingVideoRemoving(true);
    setError(null);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/lawyers/onboarding-video`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(apiErrorMessage(data, "Remove failed"));
      setOnboardingVideoUrl(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setOnboardingVideoRemoving(false);
    }
  };

  function apiErrorMessage(data: Record<string, unknown>, fallback: string): string {
    return typeof data.error === "string" ? data.error : fallback;
  }

  async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text();
    if (!text.trim()) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { error: text.slice(0, 200) || "Server returned non-JSON (check deployment logs)." };
    }
  }

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
          primary_language: formPrimaryLanguage.trim() || undefined,
          other_languages: formOtherLanguages.trim() || undefined,
          linkedin_url: formLinkedin.trim() || undefined,
          image_url: formImageUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(apiErrorMessage(data, "Failed to add lawyer"));
        return;
      }
      setFormName("");
      setFormCountry("");
      setFormExpertise("");
      setFormEmail("");
      setFormPhone("");
      setFormPrimaryLanguage("");
      setFormOtherLanguages("");
      setFormLinkedin("");
      setFormImageUrl("");
      setShowForm(false);
      fetchLawyers();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (lawyer: LawyerRow) => {
    setEditing(lawyer);
    setEditName(lawyer.name);
    setEditCountry(lawyer.country ?? "");
    setEditExpertise(lawyer.expertise);
    setEditEmail(lawyer.email ?? "");
    setEditPhone(lawyer.phone ?? "");
    setEditPrimaryLanguage(lawyer.primary_language ?? "");
    setEditOtherLanguages(lawyer.other_languages ?? "");
    setEditLinkedin(lawyer.linkedin_url ?? "");
    setEditImageUrl(lawyer.image_url ?? "");
    setError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editName.trim() || !editExpertise.trim()) {
      setError("Name and expertise are required.");
      return;
    }
    if (!editEmail.trim() && !editPhone.trim()) {
      setError("Email or phone is required.");
      return;
    }
    setEditSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/lawyers/directory/${editing.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          country: editCountry.trim() || undefined,
          expertise: editExpertise.trim(),
          email: editEmail.trim() || undefined,
          phone: editPhone.trim() || undefined,
          primary_language: editPrimaryLanguage.trim() || undefined,
          other_languages: editOtherLanguages.trim() || undefined,
          linkedin_url: editLinkedin.trim() || undefined,
          image_url: editImageUrl.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorMessage(data, "Failed to update lawyer"));
        return;
      }
      setLawyers((prev) => prev.map((l) => (l.id === editing.id ? (data as LawyerRow) : l)));
      setEditing(null);
    } catch {
      setError("Network error");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (removingId) return;
    const ok = await confirm({
      title: "Remove lawyer",
      description:
        "Remove this lawyer from the directory? They will no longer appear on the Find a Lawyer page.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    setRemovingId(id);
    setError(null);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/lawyers/directory/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(apiErrorMessage(data, "Failed to remove"));
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

      <section className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-medium text-foreground">
              <Video className="h-5 w-5 text-primary" />
              Lawyers onboarding video
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              MP4 shown once when someone opens the <strong>Find a Lawyer</strong> tab (<strong>/lawyers</strong>).
              They can replay it via the onboarding video button in the hero. Uploads go directly to Cloudinary (max
              100 MB).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
              {onboardingVideoUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {onboardingVideoUrl ? "Replace video" : "Upload MP4"}
              <input
                type="file"
                accept="video/mp4,.mp4"
                className="sr-only"
                disabled={onboardingVideoUploading || onboardingVideoRemoving}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleOnboardingVideoUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {onboardingVideoUrl && (
              <button
                type="button"
                onClick={() => void handleOnboardingVideoRemove()}
                disabled={onboardingVideoRemoving || onboardingVideoUploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                {onboardingVideoRemoving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Remove
              </button>
            )}
          </div>
        </div>
        {onboardingVideoUrl ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-black">
            <video
              src={cloudinaryVideoPlaybackUrl(onboardingVideoUrl)}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full max-h-80 object-contain"
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No video uploaded yet.</p>
        )}
      </section>

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
            <div>
              <label htmlFor="admin-lawyer-primary-language" className="block text-sm font-medium text-foreground mb-1">
                Primary language
              </label>
              <input
                id="admin-lawyer-primary-language"
                type="text"
                value={formPrimaryLanguage}
                onChange={(e) => setFormPrimaryLanguage(e.target.value)}
                maxLength={100}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. English"
              />
            </div>
            <div>
              <label htmlFor="admin-lawyer-other-languages" className="block text-sm font-medium text-foreground mb-1">
                Other languages
              </label>
              <input
                id="admin-lawyer-other-languages"
                type="text"
                value={formOtherLanguages}
                onChange={(e) => setFormOtherLanguages(e.target.value)}
                maxLength={500}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. French, Swahili"
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
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                Photo <span className="text-muted-foreground">(optional)</span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  maxLength={2048}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Image URL or upload below"
                />
                <label className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent shrink-0">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={formImageUploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setFormImageUploading(true);
                      setError(null);
                      try {
                        const fd = new FormData();
                        fd.set("file", f);
                        const r = await fetch(`${window.location.origin}/api/admin/lawyers/upload-image`, {
                          method: "POST",
                          credentials: "include",
                          body: fd,
                        });
                        const d = await parseJsonSafe(r);
                        if (r.ok && typeof d.url === "string") {
                          setFormImageUrl(d.url);
                        } else {
                          setError(
                            apiErrorMessage(
                              d,
                              r.status === 413
                                ? "Image too large for the server limit. Use a file under 5 MB or compress the photo."
                                : "Upload failed. Ensure CLOUDINARY_* env vars are set on Vercel."
                            )
                          );
                        }
                      } finally {
                        setFormImageUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                  {formImageUploading ? "Uploading…" : "Upload image"}
                </label>
              </div>
              {formImageUrl && (
                <div className="mt-2">
                  <img src={formImageUrl} alt="Preview" className="h-16 w-16 rounded-full object-cover border border-border" />
                </div>
              )}
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

      {editing && (
        <form onSubmit={handleEditSubmit} className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Edit lawyer</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-lawyer-name" className="block text-sm font-medium text-foreground mb-1">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                id="edit-lawyer-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                maxLength={200}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit-lawyer-country" className="block text-sm font-medium text-foreground mb-1">
                Country
              </label>
              <input
                id="edit-lawyer-country"
                type="text"
                value={editCountry}
                onChange={(e) => setEditCountry(e.target.value)}
                maxLength={100}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-lawyer-expertise" className="block text-sm font-medium text-foreground mb-1">
                Expertise <span className="text-destructive">*</span>
              </label>
              <input
                id="edit-lawyer-expertise"
                type="text"
                value={editExpertise}
                onChange={(e) => setEditExpertise(e.target.value)}
                required
                maxLength={500}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit-lawyer-email" className="block text-sm font-medium text-foreground mb-1">
                Email
              </label>
              <input
                id="edit-lawyer-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                maxLength={255}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit-lawyer-phone" className="block text-sm font-medium text-foreground mb-1">
                Phone
              </label>
              <input
                id="edit-lawyer-phone"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                maxLength={50}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit-lawyer-primary-language" className="block text-sm font-medium text-foreground mb-1">
                Primary language
              </label>
              <input
                id="edit-lawyer-primary-language"
                type="text"
                value={editPrimaryLanguage}
                onChange={(e) => setEditPrimaryLanguage(e.target.value)}
                maxLength={100}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit-lawyer-other-languages" className="block text-sm font-medium text-foreground mb-1">
                Other languages
              </label>
              <input
                id="edit-lawyer-other-languages"
                type="text"
                value={editOtherLanguages}
                onChange={(e) => setEditOtherLanguages(e.target.value)}
                maxLength={500}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-lawyer-linkedin" className="block text-sm font-medium text-foreground mb-1">
                LinkedIn URL
              </label>
              <input
                id="edit-lawyer-linkedin"
                type="url"
                value={editLinkedin}
                onChange={(e) => setEditLinkedin(e.target.value)}
                maxLength={500}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">Photo</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="url"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  maxLength={2048}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Image URL or upload"
                />
                <label className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent shrink-0">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={editImageUploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setEditImageUploading(true);
                      setError(null);
                      try {
                        const fd = new FormData();
                        fd.set("file", f);
                        const r = await fetch(`${window.location.origin}/api/admin/lawyers/upload-image`, {
                          method: "POST",
                          credentials: "include",
                          body: fd,
                        });
                        const d = await parseJsonSafe(r);
                        if (r.ok && typeof d.url === "string") {
                          setEditImageUrl(d.url);
                        } else {
                          setError(
                            apiErrorMessage(
                              d,
                              r.status === 413
                                ? "Image too large for the server limit. Use a file under 5 MB or compress the photo."
                                : "Upload failed. Ensure CLOUDINARY_* env vars are set on Vercel."
                            )
                          );
                        }
                      } finally {
                        setEditImageUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                  {editImageUploading ? "Uploading…" : "Upload"}
                </label>
              </div>
              {editImageUrl && (
                <div className="mt-2">
                  <img src={editImageUrl} alt="Preview" className="h-16 w-16 rounded-full object-cover border border-border" />
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSubmitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {editSubmitting ? "Saving…" : "Save changes"}
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
            <table className="w-full text-sm min-w-[800px]">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium w-14">Photo</th>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Country</th>
                  <th className="text-left p-3 font-medium max-w-[160px]">Expertise</th>
                  <th className="text-left p-3 font-medium max-w-[140px]">Languages</th>
                  <th className="text-left p-3 font-medium max-w-[160px]">Email</th>
                  <th className="text-left p-3 font-medium max-w-[120px]">Phone</th>
                  <th className="text-left p-3 font-medium w-20">Source</th>
                  <th className="text-left p-3 font-medium">Added</th>
                  <th className="text-left p-3 font-medium w-[100px] min-w-[100px] sticky right-0 bg-muted/50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] z-10">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lawyers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      No lawyers in the directory yet. Add one manually or share the form link: /lawyers/join
                    </td>
                  </tr>
                ) : (
                  lawyers.map((l) => (
                    <tr key={l.id} className="group border-b border-border hover:bg-muted/30">
                      <td className="p-3">
                        {l.image_url ? (
                          <Image src={l.image_url} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover border border-border" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 font-medium">{l.name}</td>
                      <td className="p-3 text-muted-foreground">{l.country ?? "—"}</td>
                      <td
                        className="p-3 max-w-[200px] truncate"
                        title={normalizeExpertiseField(l.expertise)}
                      >
                        {normalizeExpertiseField(l.expertise)}
                      </td>
                      <td className="p-3 max-w-[140px] truncate text-muted-foreground" title={
                        [l.primary_language, l.other_languages].filter(Boolean).join(", ") || ""
                      }>
                        {l.primary_language || l.other_languages
                          ? [l.primary_language, l.other_languages].filter(Boolean).join(", ")
                          : "—"}
                      </td>
                      <td className="p-3 max-w-[160px] truncate text-muted-foreground" title={l.email ?? ""}>
                        {l.email ?? "—"}
                      </td>
                      <td className="p-3 max-w-[120px] truncate text-muted-foreground" title={l.phone ?? ""}>
                        {l.phone ?? "—"}
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${l.source === "form" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
                          {l.source === "form" ? "Form" : "Manual"}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDate(l.created_at)}</td>
                      <td className="p-3 sticky right-0 bg-card group-hover:bg-muted/30 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] z-10 flex items-center gap-1 shrink-0 w-[100px] min-w-[100px]">
                        <button
                          type="button"
                          onClick={() => openEdit(l)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground text-xs font-medium"
                          title="Edit lawyer"
                        >
                          Edit
                        </button>
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
      {confirmDialog}
    </div>
  );
}
