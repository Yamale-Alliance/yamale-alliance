"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, Flag, Loader2, X } from "lucide-react";
import { LAW_FLAG_CATEGORIES } from "@/lib/law-flag-categories";

type Props = {
  lawId: string;
  lawTitle: string;
  isSignedIn: boolean;
  /** Compact toolbar button vs full-width control */
  variant?: "toolbar" | "inline";
};

export function LawFlagDialog({
  lawId,
  lawTitle,
  isSignedIn,
  variant = "toolbar",
}: Props) {
  const [open, setOpen] = useState(false);
  const [issueCategory, setIssueCategory] = useState("");
  const [issueDetails, setIssueDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFlag = () => {
    if (!isSignedIn) {
      window.location.assign(
        "/sign-in?redirect_url=" + encodeURIComponent(window.location.pathname + window.location.search)
      );
      return;
    }
    setError(null);
    setSubmitted(false);
    setOpen(true);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setError(null);
    }
  };

  const submitFlag = async () => {
    if (!issueCategory) {
      setError("Please select an issue type.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/laws/${lawId}/flag`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueCategory,
          issueDetails: issueDetails.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not submit flag. Please try again.");
        return;
      }
      setSubmitted(true);
      setIssueCategory("");
      setIssueDetails("");
    } finally {
      setSubmitting(false);
    }
  };

  const trigger =
    variant === "toolbar" ? (
      <div className="relative group">
        <button
          type="button"
          onClick={openFlag}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg sm:size-11 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={isSignedIn ? "Flag this law" : "Sign in to flag this law"}
          title={isSignedIn ? "Flag this law" : "Sign in to flag this law"}
        >
          <Flag className="h-5 w-5" />
        </button>
        <span className="pointer-events-none absolute right-full mr-2 top-1/2 z-10 hidden sm:block -translate-y-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
          {isSignedIn ? "Flag this law" : "Sign in to flag"}
        </span>
      </div>
    ) : (
      <button
        type="button"
        onClick={openFlag}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
      >
        <Flag className="h-4 w-4" />
        Flag this law
      </button>
    );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      {trigger}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/65 print:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex max-h-[min(90vh,calc(100%-2rem))] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl print:hidden focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-xl font-semibold">Flag this law</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground line-clamp-3">
            {lawTitle}
          </Dialog.Description>

          {submitted ? (
            <p className="mt-6 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
              Thank you. Your report was sent to the Yamalé team for review.
            </p>
          ) : (
            <>
              <p className="mt-6 text-sm text-muted-foreground">What is wrong with this document?</p>
              <div className="relative mt-2">
                <select
                  value={issueCategory}
                  onChange={(e) => setIssueCategory(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary/50"
                >
                  <option value="">Select issue type…</option>
                  {LAW_FLAG_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>

              <p className="mt-4 text-sm text-muted-foreground">Additional details (optional)</p>
              <textarea
                value={issueDetails}
                onChange={(e) => setIssueDetails(e.target.value)}
                rows={4}
                placeholder="Describe what you noticed (section, article, comparison to official source, etc.)"
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
              />

              {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

              <p className="mt-4 text-xs text-muted-foreground">
                Reports go to admin support for triage. When email is enabled, the team is notified via Resend.
              </p>
            </>
          )}

          <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {submitted ? "Close" : "Cancel"}
              </button>
            </Dialog.Close>
            {!submitted ? (
              <button
                type="button"
                onClick={() => void submitFlag()}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? "Submitting…" : "Submit flag"}
              </button>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
