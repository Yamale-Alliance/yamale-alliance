"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AiProcessStep } from "@/lib/ai-chat-process";

type Props = {
  steps: AiProcessStep[];
  isActive: boolean;
  startedAt: number;
  /** When set, elapsed time is frozen and steps are treated as complete. */
  completedAt?: number | null;
  defaultExpanded?: boolean;
};

export function AiResearchProcessPanel({
  steps,
  isActive,
  startedAt,
  completedAt = null,
  defaultExpanded = false,
}: Props) {
  const t = useTranslations("aiResearch.process");
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isComplete = completedAt != null;
  const showSpinner = isActive && !isComplete;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!showSpinner) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [showSpinner]);

  const elapsedMs = isComplete ? completedAt - startedAt : Date.now() - startedAt;
  const summary = useMemo(() => {
    const sec = Math.max(1, Math.round(elapsedMs / 1000));
    if (steps.length === 0) return t("summarySeconds", { sec });
    const doneSteps = steps.filter((s) => s.status === "done");
    const tail =
      isComplete && doneSteps.length > 0
        ? doneSteps[doneSteps.length - 1]!.message
        : doneSteps.length > 0
          ? doneSteps[doneSteps.length - 1]!.message
          : (steps[steps.length - 1]?.message ?? t("processingFallback"));
    return t("summaryWithStep", { sec, step: tail });
  }, [steps, elapsedMs, isComplete, tick, t]);

  if (steps.length === 0 && !showSpinner) return null;

  const previewStep = isComplete
    ? [...steps].reverse().find((s) => s.status === "done")
    : [...steps].reverse().find((s) => s.status === "active");

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="group flex w-full items-start gap-2 rounded-[6px] border border-border/80 bg-muted/40 px-2.5 py-2 text-left transition hover:bg-muted/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"
        aria-expanded={expanded}
      >
        <span className="mt-0.5 text-muted-foreground">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-muted-foreground">
            {showSpinner ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#C8922A]" aria-hidden />
            ) : null}
            <span className="text-foreground/80">{showSpinner ? t("working") : t("worked")}</span>
            <span className="font-normal text-muted-foreground">{summary}</span>
          </span>
          {!expanded && previewStep ? (
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{previewStep.message}</span>
          ) : null}
        </span>
      </button>

      {expanded ? (
        <ol className="ml-1.5 mt-1.5 space-y-1.5 border-l border-border/60 pl-4 dark:border-white/10">
          {steps.map((s, i) => (
            <li key={`${s.step}-${s.at}-${i}`} className="text-[12px] leading-snug">
              <span className="flex items-start gap-2">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    s.status === "done" ? "bg-emerald-500/80" : "bg-[#C8922A] animate-pulse"
                  }`}
                  aria-hidden
                />
                <span>
                  <span className={s.status === "active" ? "text-foreground" : "text-foreground/85"}>
                    {s.message}
                  </span>
                  {s.detail ? (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{s.detail}</span>
                  ) : null}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
