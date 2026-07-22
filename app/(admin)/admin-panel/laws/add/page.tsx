"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, FileUp, FileText, CheckCircle2, Link2 } from "lucide-react";
import { LAW_YEAR_MIN, LAW_YEAR_MAX } from "@/lib/admin-law-utils";
import {
  ADMIN_LAW_PDF_MAX_MB,
  isAdminLawPdfTooLarge,
} from "@/lib/admin-law-upload-limits";
import { LAW_TREATY_TYPES, type LawTreatyType } from "@/lib/law-treaty-type";
import { DEFAULT_LAW_LEVEL, LAW_LEVELS, type LawLevel } from "@/lib/law-level";
import {
  AdminVirusScanUploadBanner,
} from "@/components/admin/AdminVirusScanUploadBanner";
import { AdminLawLanguageSelect } from "@/components/admin/AdminLawLanguageSelect";
import { uploadLawPdfViaStorage } from "@/lib/admin-law-pdf-client-upload";
import { AdminLawCountryChecklist } from "@/components/admin/AdminLawCountryChecklist";
import type { LibraryCountry } from "@/lib/library-data";
import { isRegionalBodyCountry, regionalBodyByCode } from "@/lib/regional-bodies";

type Country = LibraryCountry;
type Category = { id: string; name: string };

type InputMode = "upload" | "paste" | "url";

export default function AdminLawsAddPage() {
  const t = useTranslations("admin.laws.add");
  const tc = useTranslations("admin.common");
  const tLibrary = useTranslations("library");
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countryIds, setCountryIds] = useState<string[]>([]);
  const [appliesToAll, setAppliesToAll] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [status, setStatus] = useState("In force");
  const [treatyType, setTreatyType] = useState<LawTreatyType>("Not a treaty");
  const [level, setLevel] = useState<LawLevel>(DEFAULT_LAW_LEVEL);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [languageCode, setLanguageCode] = useState("");
  const [mode, setMode] = useState<InputMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  /** Remount file input so we never set `.value` on the DOM (avoids uncontrolled→controlled warnings). */
  const [fileInputKey, setFileInputKey] = useState(0);
  const [forceOcr, setForceOcr] = useState(false);
  const [pastedContent, setPastedContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [previewingUrl, setPreviewingUrl] = useState(false);
  const [urlImportReady, setUrlImportReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** True only while the PDF bytes are uploading to storage (not during background extract). */
  const [uploadingPdfBytes, setUploadingPdfBytes] = useState(false);
  const [ingestStatusLabel, setIngestStatusLabel] = useState<string | null>(null);
  const lawUploadActive = uploadingPdfBytes && mode === "upload";
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);


  useEffect(() => {
    fetch(`${window.location.origin}/api/laws?skipEnrichment=1`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCountries(data.countries ?? []);
        setCategories(data.categories ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (appliesToAll || countryIds.length === 0) return;
    const selected = countries.filter((c) => countryIds.includes(c.id));
    if (selected.length === 0) return;
    const allRegional = selected.every((c) => isRegionalBodyCountry(c));
    if (!allRegional) return;
    const hasInternational = selected.some(
      (c) => (regionalBodyByCode(c.code)?.defaultLevel ?? "Regional") === "International"
    );
    setLevel(hasInternational ? "International" : "Regional");
  }, [appliesToAll, countryIds, countries]);

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setError(null);
    setSuccessMessage(null);
    setAddingCategory(true);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/categories`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as {
        error?: string;
        category?: { id: string; name: string };
      };
      if (!res.ok) {
        if (res.status === 409 && data.category?.id) {
          setCategoryIds((prev) =>
            prev.includes(data.category!.id) ? prev : [...prev, data.category!.id]
          );
          setSuccessMessage(t("messages.categoryAlreadySelected", { name: data.category.name }));
          setNewCategoryName("");
          return;
        }
        setError(data.error ?? t("errors.createCategory"));
        return;
      }
      if (data.category?.id) {
        setCategories((prev) => {
          const merged = [...prev, data.category!];
          return merged.sort((a, b) => a.name.localeCompare(b.name));
        });
        setCategoryIds((prev) =>
          prev.includes(data.category!.id) ? prev : [...prev, data.category!.id]
        );
        setSuccessMessage(t("messages.categoryCreated", { name: data.category.name }));
        setNewCategoryName("");
      }
    } catch {
      setError(t("errors.createCategory"));
    } finally {
      setAddingCategory(false);
    }
  };

  const handlePreviewUrl = async () => {
    setError(null);
    setSuccessMessage(null);
    const u = sourceUrl.trim();
    if (!u.startsWith("http://") && !u.startsWith("https://")) {
      setError(t("errors.invalidUrl"));
      return;
    }
    setPreviewingUrl(true);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/laws/from-url`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewOnly: true,
          url: u,
          forceOcr,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        markdown?: string;
        suggested?: { title?: string; countryId?: string | null; categoryId?: string | null; year?: number | null };
        needsCountry?: boolean;
        needsCategory?: boolean;
        usedClaude?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? t("errors.previewFailed"));
        return;
      }
      if (data.markdown) {
        setPastedContent(data.markdown);
        setMode("paste");
      }
      if (data.suggested?.title) setTitle(data.suggested.title);
      if (data.suggested?.countryId) setCountryIds([data.suggested.countryId]);
      if (data.suggested?.categoryId) setCategoryIds([data.suggested.categoryId]);
      if (data.suggested?.year != null) setYear(String(data.suggested.year));
      setUrlImportReady(true);
      let msg = data.usedClaude
        ? t("messages.previewLoadedClaude")
        : t("messages.previewLoaded");
      if (data.needsCountry || data.needsCategory) {
        msg += ` ${t("messages.previewNeedsManual")}`;
      }
      setSuccessMessage(msg);
    } catch {
      setError(t("errors.previewUrl"));
    } finally {
      setPreviewingUrl(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    if (mode === "url" && !urlImportReady) {
      setError(t("errors.previewFirst"));
      return;
    }
    if (!title.trim()) {
      setError(t("errors.titleRequired"));
      return;
    }
    if (!appliesToAll && countryIds.length === 0) {
      setError(t("errors.countryRequired"));
      return;
    }
    if (categoryIds.length === 0) {
      setError(t("errors.categoryRequired"));
      return;
    }

    if (urlImportReady && sourceUrl.trim()) {
      setSubmitting(true);
      try {
        const res = await fetch(`${window.location.origin}/api/admin/laws/from-url`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            previewOnly: false,
            url: sourceUrl.trim(),
            appliesToAllCountries: appliesToAll,
            countryIds: appliesToAll ? undefined : countryIds,
            categoryId: categoryIds[0],
            categoryIds,
            title: title.trim(),
            status,
            treatyType,
            level,
            year: (() => {
              if (!year.trim()) return null;
              const y = parseInt(year, 10);
              return Number.isNaN(y) ? null : y;
            })(),
            forceOcr,
            markdown: pastedContent.trim(),
            languageCode: languageCode || null,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? t("errors.saveLaw"));
          setSubmitting(false);
          return;
        }
        setSuccessMessage(t("messages.addedFromUrl"));
        setCategoryIds([]);
        setTitle("");
        setYear("");
        setLanguageCode("");
        setPastedContent("");
        setSourceUrl("");
        setUrlImportReady(false);
        setMode("upload");
        setSubmitting(false);
        return;
      } catch {
        setError(t("errors.saveFailed"));
        setSubmitting(false);
        return;
      }
    }

    if (mode === "upload") {
      if (!file) {
        setError(t("errors.selectPdf"));
        return;
      }
      if (file.type !== "application/pdf") {
        setError(t("errors.fileMustBePdf"));
        return;
      }
      if (isAdminLawPdfTooLarge(file.size)) {
        setError(
          t("errors.pdfTooLarge", { sizeMb: (file.size / (1024 * 1024)).toFixed(1) })
        );
        return;
      }
    } else {
      if (!pastedContent.trim()) {
        setError(t("errors.pasteRequired"));
        return;
      }
    }

    setSubmitting(true);

    if (mode === "upload" && file) {
      let storagePath: string;
      try {
        setUploadingPdfBytes(true);
        setIngestStatusLabel(null);
        setSuccessMessage(t("messages.uploadingPdf"));
        storagePath = await uploadLawPdfViaStorage(file);
      } catch (uploadErr) {
        setError(uploadErr instanceof Error ? uploadErr.message : t("errors.uploadTooLarge"));
        setSubmitting(false);
        setUploadingPdfBytes(false);
        setSuccessMessage(null);
        return;
      } finally {
        setUploadingPdfBytes(false);
      }

      try {
        setSuccessMessage(t("messages.queuedIngest"));
        setIngestStatusLabel(t("messages.queuedIngest"));
        const queueRes = await fetch(`${window.location.origin}/api/admin/laws/ingest`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfStoragePath: storagePath,
            appliesToAll: appliesToAll,
            countryIds: appliesToAll ? [] : countryIds,
            categoryIds,
            title: title.trim(),
            status,
            treatyType,
            level,
            year: year.trim() || null,
            languageCode: languageCode || null,
            forceOcr,
          }),
        });
        const queueData = (await queueRes.json().catch(() => ({}))) as {
          error?: string;
          jobId?: string;
          phaseMessage?: string;
        };
        if (!queueRes.ok || !queueData.jobId) {
          setError(queueData.error ?? t("errors.addFailed"));
          setSubmitting(false);
          setIngestStatusLabel(null);
          setSuccessMessage(null);
          return;
        }

        const jobId = queueData.jobId;
        const kickRun = () => {
          void fetch(`${window.location.origin}/api/admin/laws/ingest/${jobId}/run`, {
            method: "POST",
            credentials: "include",
          }).catch(() => {});
        };
        // Start processing immediately (in addition to server after()).
        kickRun();

        const startedAt = Date.now();
        // Scanned PDFs: malware scan + cloud OCR page-by-page can exceed one serverless window;
        // we re-kick /run when progress stalls so work can continue across invocations.
        const pollDeadlineMs = 30 * 60 * 1000;
        let lastPhaseMessage = queueData.phaseMessage ?? "";
        let lastProgressAt = Date.now();
        let lastKickAt = Date.now();

        const finishSuccess = () => {
          setSuccessMessage(t("messages.addedSuccess"));
          setIngestStatusLabel(null);
          setCategoryIds([]);
          setTitle("");
          setYear("");
          setPastedContent("");
          setFile(null);
          setFileInputKey((k) => k + 1);
          setSubmitting(false);
          if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
        };

        while (Date.now() - startedAt < pollDeadlineMs) {
          const statusRes = await fetch(
            `${window.location.origin}/api/admin/laws/ingest/${jobId}?t=${Date.now()}`,
            {
              credentials: "include",
              cache: "no-store",
              headers: { "Cache-Control": "no-cache" },
            }
          );
          const statusData = (await statusRes.json().catch(() => ({}))) as {
            error?: string;
            status?: string;
            phaseMessage?: string;
            recordsCreated?: number;
            lawIds?: string[];
          };

          if (!statusRes.ok) {
            setError(statusData.error ?? t("errors.addFailed"));
            setSubmitting(false);
            setIngestStatusLabel(null);
            setSuccessMessage(null);
            return;
          }

          if (statusData.phaseMessage) {
            setSuccessMessage(statusData.phaseMessage);
            setIngestStatusLabel(statusData.phaseMessage);
            if (statusData.phaseMessage !== lastPhaseMessage) {
              lastPhaseMessage = statusData.phaseMessage;
              lastProgressAt = Date.now();
            }
          }

          if (
            statusData.status === "completed" ||
            (Array.isArray(statusData.lawIds) && statusData.lawIds.length > 0)
          ) {
            finishSuccess();
            return;
          }

          if (statusData.status === "failed") {
            setError(statusData.error ?? t("errors.addFailed"));
            setSubmitting(false);
            setIngestStatusLabel(null);
            setSuccessMessage(null);
            return;
          }

          const stalledMs = Date.now() - lastProgressAt;
          const sinceKickMs = Date.now() - lastKickAt;
          const stillWorking =
            statusData.status === "queued" ||
            statusData.status === "scanning" ||
            statusData.status === "extracting" ||
            statusData.status === "saving";

          // Re-kick when queued, or when progress stalls (serverless worker likely timed out).
          if (
            stillWorking &&
            sinceKickMs > 45_000 &&
            (statusData.status === "queued" || stalledMs > 90_000)
          ) {
            lastKickAt = Date.now();
            kickRun();
          }

          await new Promise((r) => setTimeout(r, 2000));
        }

        setError(t("errors.requestTimeout"));
        setSubmitting(false);
        setIngestStatusLabel(null);
        setSuccessMessage(null);
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        const looksLikeNetwork =
          /failed to fetch|load failed|networkerror|network request failed/i.test(msg);
        setError(
          looksLikeNetwork
            ? t("errors.serverUnreachable")
            : msg || t("errors.generic")
        );
        setSubmitting(false);
        setIngestStatusLabel(null);
        setSuccessMessage(null);
        return;
      }
    }

    const formData = new FormData();
    if (appliesToAll) {
      formData.set("appliesToAll", "true");
    } else {
      countryIds.forEach((countryId) => formData.append("countryIds", countryId));
    }
    categoryIds.forEach((cid) => formData.append("categoryIds", cid));
    formData.set("status", status);
    formData.set("treatyType", treatyType);
    formData.set("level", level);
    formData.set("title", title.trim());
    if (year.trim()) formData.set("year", year.trim());
    if (languageCode) formData.set("languageCode", languageCode);
    formData.set("content", pastedContent.trim());

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);
      const res = await fetch(`${window.location.origin}/api/admin/laws`, {
        method: "POST",
        credentials: "include",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      let data: { error?: string } = {};
      try {
        data = (await res.json()) as { error?: string };
      } catch {
        // Non-JSON error responses can happen for oversized payloads.
      }
      if (!res.ok) {
        if (res.status === 413) {
          setError(
            data.error ??
              t("errors.uploadTooLarge")
          );
        } else {
          setError(data.error ?? t("errors.addFailed"));
        }
        setSubmitting(false);
        return;
      }
      setSuccessMessage(t("messages.addedSuccess"));
      setCategoryIds([]);
      setTitle("");
      setYear("");
      setPastedContent("");
      setFile(null);
      if (mode === "upload") setFileInputKey((k) => k + 1);
      setSubmitting(false);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setError(t("errors.requestTimeout"));
      } else {
        const msg = e instanceof Error ? e.message : "";
        const looksLikeNetwork =
          /failed to fetch|load failed|networkerror|network request failed/i.test(msg);
        setError(
          looksLikeNetwork
            ? t("errors.serverUnreachable")
            : msg || t("errors.generic")
        );
      }
      setSubmitting(false);
    }
  };


  return (
    <div className="p-4 max-w-3xl sm:p-6">
      <Link
        href="/admin-panel/laws"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </Link>
      <div>
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-4 py-3 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Mode: Upload PDF vs Paste content */}
        <div>
          <label className="block text-sm font-medium mb-2">{t("mode.title")}</label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-4 py-3 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20">
              <input
                type="radio"
                name="mode"
                value="upload"
                checked={mode === "upload"}
                onChange={() => {
                  setMode("upload");
                  setPastedContent("");
                  setUrlImportReady(false);
                  setSourceUrl("");
                }}
                className="sr-only"
              />
              <FileUp className="h-5 w-5" />
              <span>{t("mode.upload")}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-4 py-3 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20">
              <input
                type="radio"
                name="mode"
                value="paste"
                checked={mode === "paste"}
                onChange={() => {
                  setMode("paste");
                  setFile(null);
                  setUrlImportReady(false);
                }}
                className="sr-only"
              />
              <FileText className="h-5 w-5" />
              <span>{t("mode.paste")}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-4 py-3 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20">
              <input
                type="radio"
                name="mode"
                value="url"
                checked={mode === "url"}
                onChange={() => {
                  setMode("url");
                  setFile(null);
                }}
                className="sr-only"
              />
              <Link2 className="h-5 w-5" />
              <span>{t("mode.url")}</span>
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={appliesToAll}
              onChange={(e) => {
                const on = e.target.checked;
                setAppliesToAll(on);
                if (on) setCountryIds([]);
              }}
              className="mt-1 rounded border-input"
            />
            <span>
              <span className="font-medium text-foreground">{t("allCountries.title")}</span>
              <span className="block text-muted-foreground text-xs mt-0.5">
                {t("allCountries.hint")}
              </span>
            </span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t("countries.label")}{!appliesToAll ? " *" : ""}</label>
          <div className="max-h-56 overflow-y-auto rounded-md border border-input bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {appliesToAll ? t("countries.disabledHint") : t("countries.selectHint")}
              </span>
              {!appliesToAll && (
                <button
                  type="button"
                  onClick={() => setCountryIds(countries.map((c) => c.id))}
                  className="text-xs text-primary hover:underline"
                >
                  {t("countries.selectAll")}
                </button>
              )}
            </div>
            <AdminLawCountryChecklist
              countries={countries}
              selectedIds={countryIds}
              disabled={appliesToAll}
              regionalGroupLabel={tLibrary("regionalBodiesGroup")}
              sovereignGroupLabel={tLibrary("sovereignStatesGroup")}
              onChange={setCountryIds}
            />
          </div>
          {!appliesToAll && <p className="mt-1 text-xs text-muted-foreground">{t("countries.selectedCount", { count: countryIds.length })}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t("categories.label")} *</label>
          <p className="mb-2 text-xs text-muted-foreground">
            {t("categories.hint")}
          </p>
          <div className="mb-2 flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t("categories.newPlaceholder")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleAddCategory}
              disabled={addingCategory || !newCategoryName.trim()}
              className="whitespace-nowrap rounded-md border border-input px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              {addingCategory ? t("categories.adding") : t("categories.add")}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto rounded-md border border-input bg-background p-3">
            <div className="space-y-2">
              {categories.map((c) => {
                const checked = categoryIds.includes(c.id);
                return (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCategoryIds((prev) => (prev.includes(c.id) ? prev : [...prev, c.id]));
                        } else {
                          setCategoryIds((prev) => prev.filter((id) => id !== c.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span>{c.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("categories.selectedCount", { count: categoryIds.length })}</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{tc("status")}</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="In force">{t("statusValues.inForce")}</option>
            <option value="Amended">{t("statusValues.amended")}</option>
            <option value="Repealed">{t("statusValues.repealed")}</option>
            <option value="Superseded">{t("statusValues.superseded")}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t("treatyType")}</label>
          <select
            value={treatyType}
            onChange={(e) => setTreatyType(e.target.value as LawTreatyType)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {LAW_TREATY_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t("level")}</label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as LawLevel)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {LAW_LEVELS.map((option) => (
              <option key={option} value={option}>
                {t(`levelValues.${option === "National" ? "national" : option === "Regional" ? "regional" : "international"}`)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">{t("levelHint")}</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t("titleLabel")} *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSuccessMessage(null);
            }}
            placeholder={t("titlePlaceholder")}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t("yearLabel")}</label>
          <input
            type="number"
            min={LAW_YEAR_MIN}
            max={LAW_YEAR_MAX}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder={t("yearPlaceholder", { min: LAW_YEAR_MIN, max: LAW_YEAR_MAX })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <AdminLawLanguageSelect
          id="admin-law-language"
          value={languageCode}
          onChange={setLanguageCode}
        />

        {mode === "url" ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">{t("url.label")} *</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => {
                  setSourceUrl(e.target.value);
                  setUrlImportReady(false);
                  setSuccessMessage(null);
                }}
                placeholder={t("url.placeholder")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t.rich("url.hint", {
                  code: () => <code className="text-xs">CLAUDE_API_KEY</code>,
                })}
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-input bg-muted/30 px-4 py-3">
              <input
                type="checkbox"
                id="forceOcrUrl"
                checked={forceOcr}
                onChange={(e) => setForceOcr(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input"
              />
              <label htmlFor="forceOcrUrl" className="text-sm cursor-pointer">
                <span className="font-medium">{t("ocr.forceTitle")}</span>
                <span className="block text-muted-foreground mt-0.5">
                  {t("ocr.forceHint")}
                </span>
              </label>
            </div>
            <button
              type="button"
              onClick={handlePreviewUrl}
              disabled={previewingUrl || !sourceUrl.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              {previewingUrl ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("url.fetching")}
                </>
              ) : (
                t("url.previewImport")
              )}
            </button>
            {urlImportReady && (
              <p className="text-xs text-muted-foreground">
                {t("url.readyHint")}
              </p>
            )}
          </>
        ) : mode === "upload" ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">{t("upload.label")} *</label>
              <input
                key={fileInputKey}
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setSuccessMessage(null);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-4 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:text-primary-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("upload.hint")} {t("upload.sizeHint", { maxMb: ADMIN_LAW_PDF_MAX_MB })}
              </p>
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                {t("upload.waitHint")}
              </p>
              <AdminVirusScanUploadBanner
                active={lawUploadActive}
                fileName={file?.name ?? null}
                className="mt-2"
              />
              {ingestStatusLabel && !lawUploadActive ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-2 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm"
                >
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{ingestStatusLabel}</p>
                    {file?.name ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{file.name}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-input bg-muted/30 px-4 py-3">
              <input
                type="checkbox"
                id="forceOcr"
                checked={forceOcr}
                onChange={(e) => setForceOcr(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input"
              />
              <label htmlFor="forceOcr" className="text-sm cursor-pointer">
                <span className="font-medium">{t("ocr.uploadTitle")}</span>
                <span className="block text-muted-foreground mt-0.5">
                  {t("ocr.uploadHint")}
                </span>
              </label>
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">{t("content.label")} *</label>
            <textarea
              value={pastedContent}
              onChange={(e) => {
                setPastedContent(e.target.value);
                setSuccessMessage(null);
              }}
              placeholder={t("content.placeholder")}
              rows={14}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground resize-y min-h-[200px]"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("content.hint")}
              {urlImportReady ? ` ${t("content.urlReadySuffix")}` : ""}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === "upload" ? t("submit.pleaseWait") : t("submit.adding")}
              </>
            ) : (
              t("submit.addLaw")
            )}
          </button>
          <Link
            href="/admin-panel/laws"
            className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {tc("cancel")}
          </Link>
        </div>
      </form>

    </div>
  );
}
