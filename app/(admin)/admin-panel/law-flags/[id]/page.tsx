"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ExternalLink, Loader2 } from "lucide-react";
import { isAiAutoLawFlagCategory, lawFlagCategoryLabel } from "@/lib/law-flag-categories";

type Flag = {
  id: string;
  law_id: string;
  law_title: string;
  law_country: string | null;
  law_category: string | null;
  issue_category: string;
  issue_details: string | null;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  status: "open" | "in_progress" | "resolved" | "dismissed";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export default function AdminLawFlagDetailPage() {
  const t = useTranslations("admin.lawFlagsDetail");
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [flag, setFlag] = useState<Flag | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Flag["status"]>("open");
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/admin/law-flags/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { flag?: Flag }) => {
        if (d.flag) {
          setFlag(d.flag);
          setStatus(d.flag.status);
          setAdminNotes(d.flag.admin_notes ?? "");
        } else {
          setFlag(null);
        }
      })
      .catch(() => setFlag(null))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    if (!flag) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/law-flags/${flag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, adminNotes }),
      });
      const data = (await res.json()) as { flag?: Flag };
      if (res.ok && data.flag) setFlag(data.flag);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!flag) {
    return <p className="p-6 text-muted-foreground">{t("notFound")}</p>;
  }

  return (
    <div className="p-4 sm:p-6">
      <Link
        href={
          isAiAutoLawFlagCategory(flag.issue_category)
            ? "/admin-panel/ai-quality?tab=corpus-gaps"
            : "/admin-panel/law-flags"
        }
        className="text-sm font-medium text-primary hover:underline"
      >
        {isAiAutoLawFlagCategory(flag.issue_category) ? t("backToCorpusGaps") : t("backToAll")}
      </Link>
      {isAiAutoLawFlagCategory(flag.issue_category) ? (
        <Link
          href={`/admin-panel/ai-quality/corpus-gaps/${flag.id}`}
          className="ml-4 text-sm font-medium text-primary hover:underline"
        >
          {t("openFullCorpusReport")}
        </Link>
      ) : null}

      <h1 className="heading mt-4 text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {flag.user_name || t("userFallback")} ({flag.user_email || flag.user_id}) ·{" "}
        {new Date(flag.created_at).toLocaleString()}
      </p>

      <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">{flag.law_title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {[flag.law_country, flag.law_category].filter(Boolean).join(" · ")}
        </p>
        <Link
          href={`/library/${flag.law_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {t("openInLibrary")}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-muted-foreground">{t("issueType")}</dt>
            <dd className="mt-0.5 text-foreground">{lawFlagCategoryLabel(flag.issue_category)}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">{t("status")}</dt>
            <dd className="mt-0.5 capitalize text-foreground">{t(`statusValues.${flag.status}`)}</dd>
          </div>
        </dl>

        {flag.issue_details ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-muted-foreground">{t("userDetails")}</p>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm text-foreground">
              {flag.issue_details}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-foreground">{t("triage")}</h3>
        <label className="mt-4 block text-sm text-muted-foreground">
          {t("status")}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Flag["status"])}
            className="mt-1 w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="open">{t("statusValues.open")}</option>
            <option value="in_progress">{t("statusValues.in_progress")}</option>
            <option value="resolved">{t("statusValues.resolved")}</option>
            <option value="dismissed">{t("statusValues.dismissed")}</option>
          </select>
        </label>
        <label className="mt-4 block text-sm text-muted-foreground">
          {t("adminNotes")}
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder={t("adminNotesPlaceholder")}
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? t("saving") : t("save")}
        </button>
      </div>
    </div>
  );
}
