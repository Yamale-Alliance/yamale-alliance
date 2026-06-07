"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ExternalLink, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AiResponseGapKind } from "@/lib/ai-response-gap-detect";
import { gapKindLabel } from "@/lib/ai-auto-quality-flag";
import {
  parseBugConversationSnapshot,
  type AutoGapSnapshotMeta,
  type BugConversationMessage,
} from "@/lib/ai-bug-conversation-snapshot";
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
};

type BugReport = {
  id: string;
  issue_category: string | null;
  issue_details: string | null;
  conversation_snapshot: unknown;
};

type QueryLog = {
  query: string;
  response_preview: string | null;
  model: string | null;
};

function MessageBlock({
  message,
  userQuestionLabel,
  aiAnswerLabel,
}: {
  message: BugConversationMessage;
  userQuestionLabel: string;
  aiAnswerLabel: string;
}) {
  return (
    <div
      className={
        message.role === "user"
          ? "rounded-xl border border-[#C8922A]/30 bg-[#FFFDF8] p-4 dark:border-[#C8922A]/35 dark:bg-[#2D2516]/30"
          : "rounded-xl border border-border bg-card p-4"
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {message.role === "user" ? userQuestionLabel : aiAnswerLabel}
      </p>
      <div className="prose prose-sm mt-2 max-w-none text-foreground dark:prose-invert prose-p:my-2">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    </div>
  );
}

export default function AdminCorpusGapDetailPage() {
  const t = useTranslations("admin.corpusGapDetail");
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [flag, setFlag] = useState<Flag | null>(null);
  const [bugReport, setBugReport] = useState<BugReport | null>(null);
  const [queryLog, setQueryLog] = useState<QueryLog | null>(null);
  const [queryLogId, setQueryLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Flag["status"]>("open");
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/ai-corpus-gaps/${id}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("errors.failedToLoad"));
        if (!data.flag || !isAiAutoLawFlagCategory(data.flag.issue_category)) {
          throw new Error(t("errors.notCorpusGap"));
        }
        setFlag(data.flag);
        setStatus(data.flag.status);
        setAdminNotes(data.flag.admin_notes ?? "");
        setBugReport(data.bugReport ?? null);
        setQueryLog(data.queryLog ?? null);
        setQueryLogId(data.queryLogId ?? null);
      })
      .catch((e: Error) => {
        setError(e.message);
        setFlag(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const parsedConversation = useMemo(
    () => parseBugConversationSnapshot(bugReport?.conversation_snapshot),
    [bugReport?.conversation_snapshot]
  );

  const conversation: BugConversationMessage[] = useMemo(() => {
    if (parsedConversation.kind === "messages" || parsedConversation.kind === "auto_gap") {
      if (parsedConversation.messages.length > 0) return parsedConversation.messages;
    }
    if (queryLog) {
      const out: BugConversationMessage[] = [];
      if (queryLog.query.trim()) out.push({ role: "user", content: queryLog.query });
      if (queryLog.response_preview?.trim()) {
        out.push({ role: "assistant", content: queryLog.response_preview });
      }
      return out;
    }
    return [];
  }, [parsedConversation, queryLog]);

  const autoGapMeta: AutoGapSnapshotMeta | null =
    parsedConversation.kind === "auto_gap" ? parsedConversation.meta : null;

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

  if (error || !flag) {
    return (
      <div className="p-6">
        <Link href="/admin-panel/ai-quality?tab=corpus-gaps" className="text-sm text-primary hover:underline">
          {t("back")}
        </Link>
        <p className="mt-4 text-destructive">{error || t("notFound")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <Link
        href="/admin-panel/ai-quality?tab=corpus-gaps"
        className="text-sm font-medium text-primary hover:underline"
      >
        {t("back")}
      </Link>

      <h1 className="heading mt-4 text-2xl font-bold text-foreground">
        {t("title", { lawTitle: flag.law_title })}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("reportedBy", { user: flag.user_name || flag.user_email || flag.user_id })} ·{" "}
        {new Date(flag.created_at).toLocaleString()}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/35 dark:text-amber-200">
          {lawFlagCategoryLabel(flag.issue_category)}
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize text-muted-foreground">
          {flag.status.replace("_", " ")}
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("instrument")}</h2>
        <p className="mt-2 text-lg font-semibold text-foreground">{flag.law_title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {[flag.law_country, flag.law_category].filter(Boolean).join(" · ") || t("na")}
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link
            href={`/library/${flag.law_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {t("openInLibrary")}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          {bugReport?.id ? (
            <Link
              href={`/admin-panel/ai-bugs/${bugReport.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("openBugReport")}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
          {t("whatWentWrong")}
        </h2>
        {flag.issue_details ? (
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-background/80 p-4 text-sm text-foreground">
            {flag.issue_details}
          </pre>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("noDetails")}</p>
        )}
        {autoGapMeta?.matchedPhrases?.length ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("triggerPhrase", { value: autoGapMeta.matchedPhrases.join('"; "') })}
          </p>
        ) : null}
        {autoGapMeta?.gapKind ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("gapType", { value: gapKindLabel(autoGapMeta.gapKind as AiResponseGapKind) })}
          </p>
        ) : null}
        {queryLogId ? (
          <p className="mt-2 text-xs text-muted-foreground">{t("queryLogId", { id: queryLogId })}</p>
        ) : null}
        {queryLog?.model ? (
          <p className="mt-1 text-xs text-muted-foreground">{t("model", { value: queryLog.model })}</p>
        ) : null}
      </div>

      <h2 className="mt-8 text-lg font-semibold text-foreground">{t("chatTitle")}</h2>
      {conversation.length === 0 ? (
        <p className="mt-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {t("chatEmpty")}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {conversation.map((m, idx) => (
            <MessageBlock
              key={`${m.role}-${idx}`}
              message={m}
              userQuestionLabel={t("roles.userQuestion")}
              aiAnswerLabel={t("roles.aiAnswer")}
            />
          ))}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-border bg-card p-4 sm:p-6">
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
