"use client";

import type { FormEvent, RefObject } from "react";
import { Send, Square } from "lucide-react";
import { useAIResearchShellStyles } from "./AIResearchShellStylesContext";

type AiResearchComposerProps = {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSend: (text: string) => void;
  isTurnBusy: boolean;
  stopGenerating: () => void;
  atLimit: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  mobileKeyboardInset: number;
  variant: "hero" | "dock";
  placeholder: string;
  sendHint: string;
  tapSendHint: string;
  generatingHint: string;
  generatingLabel: string;
  stopLabel: string;
  sendLabel: string;
};

export function AiResearchComposer({
  input,
  setInput,
  onSubmit,
  onSend,
  isTurnBusy,
  stopGenerating,
  atLimit,
  textareaRef,
  mobileKeyboardInset,
  variant,
  placeholder,
  sendHint,
  tapSendHint,
  generatingHint,
  generatingLabel,
  stopLabel,
  sendLabel,
}: AiResearchComposerProps) {
  const styles = useAIResearchShellStyles();
  const shellClass =
    variant === "hero"
      ? `${styles.composerShell} ${styles.composerShellHero}`
      : `${styles.composerShell} ${styles.composerShellDock}`;

  return (
    <div
      className={variant === "dock" ? styles.dockWrap : styles.composerWrap}
      style={
        variant === "dock"
          ? { paddingBottom: `max(0.75rem, env(safe-area-inset-bottom), ${mobileKeyboardInset}px)` }
          : undefined
      }
    >
      <form onSubmit={onSubmit}>
        <div className={shellClass}>
          <div className={styles.composerInner}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => {
                if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
                  return;
                }
                requestAnimationFrame(() => {
                  textareaRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                });
              }}
              onTouchStart={() => {
                if (document.activeElement !== textareaRef.current) {
                  textareaRef.current?.focus({ preventScroll: true });
                }
              }}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="on"
              spellCheck
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !atLimit && !isTurnBusy) {
                    void onSend(input);
                  }
                }
              }}
              placeholder={placeholder}
              disabled={atLimit}
              rows={variant === "hero" ? 3 : 2}
              className={styles.composerTextarea}
            />
            {isTurnBusy ? (
              <button
                type="button"
                onClick={stopGenerating}
                className={styles.composerSend}
                aria-label={stopLabel}
                title={stopLabel}
              >
                <Square className="h-4 w-4 fill-current" strokeWidth={0} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || atLimit}
                className={styles.composerSend}
                aria-label={sendLabel}
              >
                <Send className="h-4 w-4" strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>
        <p className={`${styles.composerHint} ${variant === "dock" ? "hidden sm:block" : ""}`}>
          {isTurnBusy ? generatingHint : sendHint}
        </p>
        {variant === "dock" ? (
          <p className={`${styles.composerHint} sm:hidden`}>
            {isTurnBusy ? generatingLabel : tapSendHint}
          </p>
        ) : null}
      </form>
    </div>
  );
}
