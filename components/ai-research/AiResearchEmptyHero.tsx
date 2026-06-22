"use client";

import type { FormEvent, RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import { Briefcase, Globe2, Pickaxe, Sparkles, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { AiResearchComposer } from "./AiResearchComposer";
import { useAIResearchShellStyles } from "./AIResearchShellStylesContext";

const QUICK_PROMPT_QUESTIONS = {
  mining:
    "Summarize the main licensing and environmental obligations for mining projects in Ethiopia.",
  afcfta: "What documents are needed for an AfCFTA certificate of origin for manufactured goods?",
  corporate: "What are the requirements for company registration in Ghana?",
  employment: "What are the key labour protections for employees in South Africa?",
} as const;

type QuickPromptId = keyof typeof QUICK_PROMPT_QUESTIONS;

const QUICK_PROMPTS: Array<{
  id: QuickPromptId;
  icon: LucideIcon;
}> = [
  { id: "mining", icon: Pickaxe },
  { id: "afcfta", icon: Globe2 },
  { id: "corporate", icon: Briefcase },
  { id: "employment", icon: Users },
];

type AiResearchEmptyHeroProps = {
  exampleQuestions: string[];
  onFillPrompt: (text: string) => void;
  atLimit: boolean;
  isTurnBusy: boolean;
  input: string;
  setInput: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSend: (text: string) => void;
  stopGenerating: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  mobileKeyboardInset: number;
  piiWarningDismissed: boolean;
  onDismissPiiWarning: () => void;
};

export function AiResearchEmptyHero({
  exampleQuestions,
  onFillPrompt,
  atLimit,
  isTurnBusy,
  input,
  setInput,
  onSubmit,
  onSend,
  stopGenerating,
  textareaRef,
  mobileKeyboardInset,
  piiWarningDismissed,
  onDismissPiiWarning,
}: AiResearchEmptyHeroProps) {
  const t = useTranslations("aiResearch");
  const styles = useAIResearchShellStyles();

  return (
    <section className={styles.hero} aria-label={t("title")}>
      <div className={styles.heroMark} aria-hidden>
        <Sparkles className="h-6 w-6 text-[#C8922A] dark:text-[#E8B84B]" strokeWidth={1.5} />
      </div>
      <p className={styles.heroEyebrow}>{t("emptyHero.eyebrow")}</p>
      <h2 className={styles.heroTitle}>{t("emptyHero.title")}</h2>
      <p className={styles.heroSubtitle}>{t("emptyHero.subtitle")}</p>

      {!piiWarningDismissed ? (
        <div role="status" className={`${styles.piiBanner} mx-auto mb-4 w-full max-w-[42rem] text-left`}>
          <p className="flex-1">{t("emptyHero.piiNotice")}</p>
          <button
            type="button"
            onClick={onDismissPiiWarning}
            className="shrink-0 rounded-md px-2 py-0.5 text-[12px] font-semibold opacity-80 transition hover:opacity-100"
            aria-label={t("emptyHero.dismissPii")}
          >
            {t("emptyHero.dismissPii")}
          </button>
        </div>
      ) : null}

      <AiResearchComposer
        input={input}
        setInput={setInput}
        onSubmit={onSubmit}
        onSend={onSend}
        isTurnBusy={isTurnBusy}
        stopGenerating={stopGenerating}
        atLimit={atLimit}
        textareaRef={textareaRef}
        mobileKeyboardInset={mobileKeyboardInset}
        variant="hero"
        placeholder={t("describeQuestion")}
        sendHint={t("sendHint")}
        tapSendHint={t("tapSend")}
        generatingHint={t("generatingHint")}
        generatingLabel={t("generating")}
        stopLabel={t("stopGenerating")}
        sendLabel={t("sendMessage")}
      />

      <div className={styles.quickPromptRow}>
        {QUICK_PROMPTS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            disabled={atLimit || isTurnBusy}
            onClick={() => onFillPrompt(QUICK_PROMPT_QUESTIONS[id])}
            className={styles.quickChip}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            {t(`emptyHero.quickPrompts.${id}`)}
          </button>
        ))}
      </div>

      <div className={styles.exampleGrid}>
        {exampleQuestions.map((question) => (
          <button
            key={question}
            type="button"
            disabled={atLimit || isTurnBusy}
            onClick={() => onFillPrompt(question)}
            className={styles.exampleCard}
          >
            {question}
          </button>
        ))}
      </div>
    </section>
  );
}
