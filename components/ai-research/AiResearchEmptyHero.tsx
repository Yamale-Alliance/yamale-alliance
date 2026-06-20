"use client";

import type { FormEvent, RefObject } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { AiResearchComposer } from "./AiResearchComposer";
import { useAIResearchShellStyles } from "./AIResearchShellStylesContext";

type AiResearchEmptyHeroProps = {
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
    </section>
  );
}
