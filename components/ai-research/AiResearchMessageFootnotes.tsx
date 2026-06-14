"use client";

import Link from "next/link";
import { AlertCircle, Scale } from "lucide-react";
import type { AiResearchContentGap, AiResearchLawyerNudge } from "@/lib/ai-research-user-messaging";
import { AI_RESEARCH_ANSWER_FOOTER } from "@/lib/ai-research-user-messaging";

type Props = {
  contentGap?: AiResearchContentGap | null;
  lawyerNudge?: AiResearchLawyerNudge | null;
  showAnswerFooter?: boolean;
  answerFooter?: string;
};

export function AiResearchMessageFootnotes({
  contentGap,
  lawyerNudge,
  showAnswerFooter = true,
  answerFooter = AI_RESEARCH_ANSWER_FOOTER,
}: Props) {
  return (
    <>
      {contentGap ? (
        <div
          className="mt-3 rounded-[10px] border border-amber-300/70 bg-amber-50/90 p-3 dark:border-amber-800/50 dark:bg-amber-950/35"
          role="status"
        >
          <div className="flex gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-800 dark:text-amber-200" aria-hidden />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-amber-950 dark:text-amber-50">{contentGap.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-amber-900/90 dark:text-amber-100/85">
                {contentGap.body}
              </p>
              {contentGap.ctaHref && contentGap.ctaLabel ? (
                <Link
                  href={contentGap.ctaHref}
                  className="mt-2 inline-flex text-[12px] font-semibold text-[#8a6520] underline-offset-2 hover:underline dark:text-[#F0C45C]"
                >
                  {contentGap.ctaLabel} →
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {lawyerNudge ? (
        <div className="mt-3 rounded-[10px] border border-[#C8922A]/35 bg-[#FFFDF8] p-3 dark:border-[#C8922A]/40 dark:bg-[#2D2516]/40">
          <div className="flex gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C8922A]/15">
              <Scale className="h-4 w-4 text-[#8a6520] dark:text-[#F0C45C]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#0D1B2A] dark:text-white/95">
                Need a {lawyerNudge.country} lawyer for this topic?
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#5D5348] dark:text-white/70">
                {lawyerNudge.networkEnabled ? (
                  <>
                    {lawyerNudge.count} verified {lawyerNudge.count === 1 ? "lawyer" : "lawyers"} on the Yamalé
                    Network list <span className="font-medium">{lawyerNudge.category}</span> among their practice
                    areas. Pay once per search to unlock contact details and arrange a consultation on the law you
                    asked about.
                  </>
                ) : (
                  <>
                    The Yamalé lawyer directory is coming soon. You can still browse the Legal Library for{" "}
                    {lawyerNudge.country} materials in the meantime.
                  </>
                )}
              </p>
              {lawyerNudge.networkEnabled ? (
                <Link
                  href={lawyerNudge.href}
                  className="mt-2 inline-flex text-[12px] font-semibold text-[#C8922A] hover:text-[#b88424] dark:text-[#F0C45C] dark:hover:text-[#FFD67A]"
                >
                  Find lawyers & unlock contacts →
                </Link>
              ) : (
                <Link
                  href="/library"
                  className="mt-2 inline-flex text-[12px] font-semibold text-[#C8922A] hover:text-[#b88424] dark:text-[#F0C45C]"
                >
                  Browse Legal Library →
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showAnswerFooter ? (
        <p className="mt-3 border-t border-border/60 pt-2.5 text-[11px] leading-relaxed text-muted-foreground dark:border-white/10">
          {answerFooter}
        </p>
      ) : null}
    </>
  );
}
