"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loader2, Briefcase, Plus, Trash2, Download, Upload, Video, X, Tags, Play, ChevronUp, Pencil, ArrowLeft } from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";
import {
  dedupeExpertiseSegments,
  formatExpertiseSelection,
  parseExpertiseSegments,
} from "@/lib/lawyer-expertise";
import {
  collectLawyerLanguages,
  formatLawyerLanguagesLabel,
  splitLawyerLanguagesForStorage,
} from "@/lib/lawyer-languages";
import { LawyerLanguagesPicker } from "@/components/lawyers/LawyerLanguagesPicker";
import { LawyerExpertiseSlots } from "@/components/lawyers/LawyerExpertiseSlots";
import { LawyerDirectoryPhotoField } from "@/components/admin/LawyerDirectoryPhotoField";
import { cloudinaryVideoPlaybackUrl } from "@/lib/cloudinary-video-playback";
import {
  prefetchLawyerDirectoryImageUploadSignature,
  uploadLawyerDirectoryPhoto,
  LawyerDirectoryPhotoTooLargeError,
} from "@/lib/lawyer-directory-image-cloudinary-client";
import { useAdminMainScrollToTop } from "@/components/admin/useAdminMainScrollToTop";
import {
  LawyerApplicationReviewDialog,
  type LawyerApplicationSummary,
} from "@/components/admin/LawyerApplicationReviewDialog";

type LawyerRow = LawyerApplicationSummary;

export default function AdminLawyersPage() {
  const t = useTranslations("admin.lawyers");
  const tc = useTranslations("admin.common");
  const [lawyers, setLawyers] = useState<LawyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const [formName, setFormName] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formExpertise, setFormExpertise] = useState<string[]>([]);
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLanguages, setFormLanguages] = useState<string[]>([]);
  const [formYearsExperience, setFormYearsExperience] = useState("");
  const [formLinkedin, setFormLinkedin] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formImageUploading, setFormImageUploading] = useState(false);

  const [editing, setEditing] = useState<LawyerRow | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editExpertise, setEditExpertise] = useState<string[]>([]);
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLanguages, setEditLanguages] = useState<string[]>([]);
  const [editYearsExperience, setEditYearsExperience] = useState("");
  const [editLinkedin, setEditLinkedin] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editImageUploading, setEditImageUploading] = useState(false);

  const [onboardingVideoUrl, setOnboardingVideoUrl] = useState<string | null>(null);
  const [onboardingVideoUploading, setOnboardingVideoUploading] = useState(false);
  const [onboardingVideoRemoving, setOnboardingVideoRemoving] = useState(false);
  const [onboardingVideoPreviewOpen, setOnboardingVideoPreviewOpen] = useState(false);
  const [catalogPracticeAreas, setCatalogPracticeAreas] = useState<string[]>([]);
  const [catalogLanguages, setCatalogLanguages] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved">("all");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const fetchCatalog = () => {
    fetch(`${window.location.origin}/api/lawyers/catalog`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { practiceAreas?: string[]; languages?: string[] }) => {
        if (Array.isArray(data.practiceAreas)) setCatalogPracticeAreas(data.practiceAreas);
        if (Array.isArray(data.languages)) setCatalogLanguages(data.languages);
      })
      .catch(() => {});
  };

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
    fetchCatalog();
  }, []);

  useEffect(() => {
    if (!showForm && !editing) return;
    prefetchLawyerDirectoryImageUploadSignature(window.location.origin);
  }, [showForm, editing]);

  const handleOnboardingVideoUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".mp4") && file.type !== "video/mp4") {
      setError(t("errors.videoMustBeMp4"));
      return;
    }
    const maxBytes = 100 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(t("errors.videoTooLarge"));
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
      setError(e instanceof Error ? e.message : t("errors.videoUploadFailed"));
    } finally {
      setOnboardingVideoUploading(false);
    }
  };

  const handleOnboardingVideoRemove = async () => {
    const ok = await confirm({
      title: t("video.removeTitle"),
      description: t("video.removeDescription"),
      confirmLabel: t("video.removeButton"),
      cancelLabel: tc("cancel"),
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
      setOnboardingVideoPreviewOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.removeFailed"));
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
      return { error: text.slice(0, 200) || t("errors.serverNonJson") };
    }
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formExpertise.length === 0) {
      setError(t("errors.nameExpertiseRequired"));
      return;
    }
    if (formExpertise.length > 3) {
      setError(t("errors.expertiseMax"));
      return;
    }
    if (!formEmail.trim() && !formPhone.trim()) {
      setError(t("errors.emailOrPhoneRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const languageFields = splitLawyerLanguagesForStorage(formLanguages);
      const yearsParsed =
        formYearsExperience.trim() === ""
          ? null
          : Number.parseInt(formYearsExperience.trim(), 10);
      const res = await fetch(`${window.location.origin}/api/admin/lawyers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          country: formCountry.trim() || undefined,
          city: formCity.trim() || undefined,
          expertise: formatExpertiseSelection(formExpertise),
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          primary_language: languageFields.primary_language || undefined,
          other_languages: languageFields.other_languages || undefined,
          years_experience: yearsParsed,
          linkedin_url: formLinkedin.trim() || undefined,
          image_url: formImageUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(apiErrorMessage(data, t("errors.addFailed")));
        return;
      }
      setFormName("");
      setFormCountry("");
      setFormCity("");
      setFormExpertise([]);
      setFormEmail("");
      setFormPhone("");
      setFormLanguages([]);
      setFormYearsExperience("");
      setFormLinkedin("");
      setFormImageUrl("");
      setShowForm(false);
      fetchLawyers();
    } catch {
      setError(tc("networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (lawyer: LawyerRow) => {
    setShowForm(false);
    setEditing(lawyer);
    setEditName(lawyer.name);
    setEditCountry(lawyer.country ?? "");
    setEditCity(lawyer.city ?? "");
    setEditExpertise(dedupeExpertiseSegments(parseExpertiseSegments(lawyer.expertise)));
    setEditEmail(lawyer.email ?? "");
    setEditPhone(lawyer.phone ?? "");
    setEditLanguages(collectLawyerLanguages(lawyer.primary_language, lawyer.other_languages));
    setEditYearsExperience(
      lawyer.years_experience !== null && lawyer.years_experience !== undefined
        ? String(lawyer.years_experience)
        : ""
    );
    setEditLinkedin(lawyer.linkedin_url ?? "");
    setEditImageUrl(lawyer.image_url ?? "");
    setError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editName.trim() || editExpertise.length === 0) {
      setError(t("errors.nameExpertiseRequired"));
      return;
    }
    if (editExpertise.length > 3) {
      setError(t("errors.expertiseMax"));
      return;
    }
    if (!editEmail.trim() && !editPhone.trim()) {
      setError(t("errors.emailOrPhoneRequired"));
      return;
    }
    setEditSubmitting(true);
    setError(null);
    try {
      const languageFields = splitLawyerLanguagesForStorage(editLanguages);
      const yearsParsed =
        editYearsExperience.trim() === ""
          ? null
          : Number.parseInt(editYearsExperience.trim(), 10);
      const res = await fetch(`${window.location.origin}/api/admin/lawyers/directory/${editing.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          country: editCountry.trim() || undefined,
          city: editCity.trim() || undefined,
          expertise: formatExpertiseSelection(editExpertise),
          email: editEmail.trim() || undefined,
          phone: editPhone.trim() || undefined,
          primary_language: languageFields.primary_language || undefined,
          other_languages: languageFields.other_languages || undefined,
          years_experience: yearsParsed,
          linkedin_url: editLinkedin.trim() || undefined,
          image_url: editImageUrl.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorMessage(data, t("errors.updateFailed")));
        return;
      }
      setLawyers((prev) => prev.map((l) => (l.id === editing.id ? (data as LawyerRow) : l)));
      setEditing(null);
    } catch {
      setError(tc("networkError"));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (removingId) return;
    const ok = await confirm({
      title: t("removeLawyerTitle"),
      description: t("removeLawyerDescription"),
      confirmLabel: t("removeLawyerButton"),
      cancelLabel: tc("cancel"),
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
        setError(apiErrorMessage(data, t("errors.removeFailed")));
        return;
      }
      setLawyers((prev) => prev.filter((l) => l.id !== id));
    } catch {
      setError(tc("networkError"));
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

  const filteredLawyers = lawyers.filter((l) => {
    if (statusFilter === "pending") return !l.approved;
    if (statusFilter === "approved") return l.approved;
    return true;
  });

  const pendingCount = lawyers.filter((l) => !l.approved).length;

  const handleLawyerUpdated = (updated: LawyerRow) => {
    setLawyers((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
  };

  const exportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError(tc("popupBlocked"));
      return;
    }
    const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const generated = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>${esc(t("export.documentTitle"))}</title>
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
      <h1 class="report-title">${esc(t("export.reportTitle"))}</h1>
      <p class="report-meta">${esc(t("export.generated", { date: generated }))}</p>
      <table>
        <thead><tr><th>${esc(t("export.tableHeaders.name"))}</th><th>${esc(t("export.tableHeaders.country"))}</th><th>${esc(t("export.tableHeaders.expertise"))}</th><th>${esc(t("export.tableHeaders.email"))}</th><th>${esc(t("export.tableHeaders.phone"))}</th><th>${esc(t("export.tableHeaders.added"))}</th></tr></thead>
        <tbody>
          ${lawyers.map((l) => `<tr><td>${esc(l.name)}</td><td>${esc(l.country ?? "—")}</td><td>${esc(l.expertise)}</td><td>${esc(l.email ?? "—")}</td><td>${esc(l.phone ?? "—")}</td><td>${esc(formatDate(l.created_at))}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="footer">${esc(t("export.footer"))}</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const isFormView = showForm || editing !== null;

  useAdminMainScrollToTop(isFormView, showForm, editing?.id);

  const closeFormView = () => {
    setShowForm(false);
    setEditing(null);
    setError(null);
  };

  const openAddForm = () => {
    setEditing(null);
    setShowForm(true);
    setError(null);
  };

  const handlePhotoUpload = async (
    file: File,
    setUrl: (url: string) => void,
    setUploading: (uploading: boolean) => void
  ) => {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadLawyerDirectoryPhoto(window.location.origin, file);
      setUrl(url);
    } catch (err) {
      if (err instanceof LawyerDirectoryPhotoTooLargeError) {
        setError(t("errors.imageExceeds5Mb"));
      } else {
        setError(err instanceof Error ? err.message : t("errors.uploadFailed"));
      }
    } finally {
      setUploading(false);
    }
  };

  const backToListButton = (
    <button
      type="button"
      onClick={closeFormView}
      className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
    >
      <ArrowLeft className="h-4 w-4" />
      {t("backToList")}
    </button>
  );

  return (
    <div className="p-4 sm:p-6">
      {isFormView ? (
        <>
          <div className="mb-6">{backToListButton}</div>
          <h1 className="text-2xl font-semibold">
            {showForm ? t("form.addTitle") : t("form.editTitle")}
          </h1>

          {error && (
            <div className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {showForm && (
        <form onSubmit={handleAddSubmit} className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="admin-lawyer-name" className="block text-sm font-medium text-foreground mb-1">
                {tc("name")} <span className="text-destructive">*</span>
              </label>
              <input
                id="admin-lawyer-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                maxLength={200}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("form.placeholders.fullName")}
              />
            </div>
            <div>
              <label htmlFor="admin-lawyer-country" className="block text-sm font-medium text-foreground mb-1">
                {t("table.country")}
              </label>
              <input
                id="admin-lawyer-country"
                type="text"
                value={formCountry}
                onChange={(e) => setFormCountry(e.target.value)}
                maxLength={100}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("form.placeholders.country")}
              />
            </div>
            <div>
              <label htmlFor="admin-lawyer-city" className="block text-sm font-medium text-foreground mb-1">
                {t("table.city")}
              </label>
              <input
                id="admin-lawyer-city"
                type="text"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                maxLength={100}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("form.placeholders.city")}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("form.photo")} <span className="text-muted-foreground">({t("optional")})</span>
              </label>
              <LawyerDirectoryPhotoField
                imageUrl={formImageUrl}
                uploading={formImageUploading}
                onImageUrlChange={setFormImageUrl}
                onUpload={(file) => void handlePhotoUpload(file, setFormImageUrl, setFormImageUploading)}
                onClear={() => setFormImageUrl("")}
                onSizeError={() => setError(t("errors.imageExceeds5Mb"))}
              />
            </div>
            <div className="sm:col-span-2">
              <LawyerExpertiseSlots
                idPrefix="admin-lawyer-expertise"
                label={`${t("table.expertise")} *`}
                description={t("form.expertiseDescription")}
                value={formExpertise}
                onChange={setFormExpertise}
                options={catalogPracticeAreas}
                maxAreas={3}
                addLabel={t("form.addPracticeArea")}
                removeLabel={t("form.removePracticeArea")}
                maxAreasHint={t("form.expertiseMaxHint")}
              />
            </div>
            <div>
              <label htmlFor="admin-lawyer-years" className="block text-sm font-medium text-foreground mb-1">
                {t("form.yearsExperience")} <span className="text-muted-foreground">({t("optional")})</span>
              </label>
              <input
                id="admin-lawyer-years"
                type="number"
                min={0}
                max={80}
                value={formYearsExperience}
                onChange={(e) => setFormYearsExperience(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("form.placeholders.yearsExperience")}
              />
            </div>
            <div>
              <label htmlFor="admin-lawyer-email" className="block text-sm font-medium text-foreground mb-1">
                {tc("email")} <span className="text-destructive">*</span>
              </label>
              <input
                id="admin-lawyer-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                maxLength={255}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("form.placeholders.email")}
              />
            </div>
            <div>
              <label htmlFor="admin-lawyer-phone" className="block text-sm font-medium text-foreground mb-1">
                {t("table.phone")}
              </label>
              <input
                id="admin-lawyer-phone"
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                maxLength={50}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("form.placeholders.phone")}
              />
            </div>
            <div className="sm:col-span-2">
              <LawyerLanguagesPicker
                idPrefix="admin-lawyer-language"
                label={t("form.languages")}
                description={t("form.languagesDescription")}
                value={formLanguages}
                onChange={setFormLanguages}
                options={catalogLanguages}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="admin-lawyer-linkedin" className="block text-sm font-medium text-foreground mb-1">
                {t("form.linkedin")} <span className="text-muted-foreground">({t("optional")})</span>
              </label>
              <input
                id="admin-lawyer-linkedin"
                type="url"
                value={formLinkedin}
                onChange={(e) => setFormLinkedin(e.target.value)}
                maxLength={500}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("form.placeholders.linkedin")}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={closeFormView}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? t("adding") : t("addLawyer")}
            </button>
          </div>
        </form>
      )}

      {editing && (
        <form onSubmit={handleEditSubmit} className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-lawyer-name" className="block text-sm font-medium text-foreground mb-1">
                {tc("name")} <span className="text-destructive">*</span>
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
                {t("table.country")}
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
            <div>
              <label htmlFor="edit-lawyer-city" className="block text-sm font-medium text-foreground mb-1">
                {t("table.city")}
              </label>
              <input
                id="edit-lawyer-city"
                type="text"
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                maxLength={100}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("form.placeholders.city")}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">{t("form.photo")}</label>
              <LawyerDirectoryPhotoField
                imageUrl={editImageUrl}
                uploading={editImageUploading}
                onImageUrlChange={setEditImageUrl}
                onUpload={(file) => void handlePhotoUpload(file, setEditImageUrl, setEditImageUploading)}
                onClear={() => setEditImageUrl("")}
                onSizeError={() => setError(t("errors.imageExceeds5Mb"))}
              />
            </div>
            <div className="sm:col-span-2">
              <LawyerExpertiseSlots
                idPrefix="edit-lawyer-expertise"
                label={`${t("table.expertise")} *`}
                description={t("form.expertiseDescription")}
                value={editExpertise}
                onChange={setEditExpertise}
                options={catalogPracticeAreas}
                maxAreas={3}
                addLabel={t("form.addPracticeArea")}
                removeLabel={t("form.removePracticeArea")}
                maxAreasHint={t("form.expertiseMaxHint")}
              />
            </div>
            <div>
              <label htmlFor="edit-lawyer-years" className="block text-sm font-medium text-foreground mb-1">
                {t("form.yearsExperience")}
              </label>
              <input
                id="edit-lawyer-years"
                type="number"
                min={0}
                max={80}
                value={editYearsExperience}
                onChange={(e) => setEditYearsExperience(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("form.placeholders.yearsExperience")}
              />
            </div>
            <div>
              <label htmlFor="edit-lawyer-email" className="block text-sm font-medium text-foreground mb-1">
                {tc("email")}
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
                {t("table.phone")}
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
            <div className="sm:col-span-2">
              <LawyerLanguagesPicker
                idPrefix="edit-lawyer-language"
                label={t("form.languages")}
                description={t("form.languagesDescription")}
                value={editLanguages}
                onChange={setEditLanguages}
                options={catalogLanguages}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-lawyer-linkedin" className="block text-sm font-medium text-foreground mb-1">
                {t("form.linkedin")}
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
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={closeFormView}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              disabled={editSubmitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {editSubmitting ? tc("saving") : t("saveChanges")}
            </button>
          </div>
        </form>
      )}

          <div className="mt-8 border-t border-border pt-6">{backToListButton}</div>
        </>
      ) : (
        <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            {t("title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("subtitle")}
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
              {tc("exportPdf")}
            </button>
          )}
          <Link
            href="/admin-panel/lawyers/catalog"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Tags className="h-4 w-4" />
            {t("manageCatalog")}
          </Link>
          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {t("addLawyer")}
          </button>
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-base font-medium text-foreground">
              <Video className="h-4 w-4 text-primary" />
              {t("video.title")}
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              {t.rich("video.description", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            {onboardingVideoUrl ? (
              <p className="mt-2 text-xs text-muted-foreground">{t("video.configured")}</p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{t("video.empty")}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onboardingVideoUrl ? (
              <button
                type="button"
                onClick={() => setOnboardingVideoPreviewOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                {onboardingVideoPreviewOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {onboardingVideoPreviewOpen ? t("video.hidePreview") : t("video.preview")}
              </button>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
              {onboardingVideoUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {onboardingVideoUrl ? t("video.replace") : t("video.upload")}
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
                {t("video.removeButton")}
              </button>
            )}
          </div>
        </div>
        {onboardingVideoUrl && onboardingVideoPreviewOpen ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-black">
            <video
              src={cloudinaryVideoPlaybackUrl(onboardingVideoUrl)}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full max-h-56 object-contain"
            />
          </div>
        ) : null}
      </section>

      {error && (
        <div className="mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["all", "pending", "approved"] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              statusFilter === filter
                ? "bg-primary text-primary-foreground"
                : "border border-input bg-background hover:bg-accent"
            }`}
          >
            {t(`filters.${filter}`)}
            {filter === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredLawyers.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="mt-6 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {filteredLawyers.map((l) => {
            const expertiseAreas = dedupeExpertiseSegments(parseExpertiseSegments(l.expertise));
            const languagesLabel = formatLawyerLanguagesLabel(
              collectLawyerLanguages(l.primary_language, l.other_languages)
            );
            const location = [l.city, l.country].filter(Boolean).join(", ") || "—";

            return (
              <article
                key={l.id}
                className="flex flex-col gap-4 p-4 transition hover:bg-muted/30 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="shrink-0">
                    {l.image_url ? (
                      <Image
                        src={l.image_url}
                        alt=""
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded-full border border-border object-cover"
                      />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/40 text-xs text-muted-foreground">
                        —
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-foreground">{l.name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          l.approved
                            ? "bg-green-500/15 text-green-700 dark:text-green-400"
                            : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        {l.approved ? t("status.approved") : t("status.pending")}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          l.source === "form"
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {l.source === "form" ? t("source.form") : t("source.manual")}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {expertiseAreas.length > 0 ? (
                        expertiseAreas.map((area) => (
                          <span
                            key={area}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {area}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                    <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="sr-only">{t("table.city")}</dt>
                        <dd className="truncate" title={location}>
                          {location}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="sr-only">{t("table.languages")}</dt>
                        <dd className="truncate" title={languagesLabel}>
                          {languagesLabel || "—"}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="sr-only">{tc("email")}</dt>
                        <dd className="truncate">
                          {l.email ? (
                            <a href={`mailto:${l.email}`} className="hover:text-foreground hover:underline">
                              {l.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="sr-only">{t("table.phone")}</dt>
                        <dd className="truncate" title={l.phone ?? undefined}>
                          {l.phone ?? "—"}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("table.added")}: {formatDate(l.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  {!l.approved ? (
                    <button
                      type="button"
                      onClick={() => setReviewingId(l.id)}
                      className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      {t("review.viewApplication")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openEdit(l)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    title={t("editLawyer")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(l.id)}
                    disabled={removingId === l.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    title={t("removeFromDirectory")}
                  >
                    {removingId === l.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {t("removeLawyerButton")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        {t.rich("publicForm", {
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
        </>
      )}
      {confirmDialog}
      <LawyerApplicationReviewDialog
        lawyerId={reviewingId}
        onClose={() => setReviewingId(null)}
        onUpdated={handleLawyerUpdated}
      />
    </div>
  );
}
