"use client";

import { useTranslations } from "next-intl";
import { FoundersNotePortrait } from "@/components/founders-note/FoundersNotePortrait";

type Props = {
  className?: string;
  portraitUrl?: string | null;
};

export function FoundersNoteBody({ className = "", portraitUrl = null }: Props) {
  const t = useTranslations("foundersNotePage");
  const paragraphs = t.raw("paragraphs") as string[];

  return (
    <article className={className}>
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C8922A]">
          {t("eyebrow")}
        </p>
        <h1 className="heading mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
      </header>

      <div className="mt-6 space-y-4 text-[15px] leading-[1.75] text-foreground/90 sm:text-base">
        {paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
      </div>

      <footer className="mt-8 border-t border-border pt-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          {portraitUrl ? (
            <FoundersNotePortrait url={portraitUrl} size="lg" className="shrink-0" />
          ) : null}
          <div className="text-center sm:text-left">
            <p className="heading text-lg font-semibold text-foreground">
              — {t("signature.name")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t("signature.title")}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("signature.location")}</p>
          </div>
        </div>
      </footer>
    </article>
  );
}
