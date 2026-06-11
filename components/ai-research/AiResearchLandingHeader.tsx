"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  prototypeHeroEyebrowClass,
  prototypeNavyHeroSectionClass,
  PROTOTYPE_HERO_GRID_PATTERN,
} from "@/components/layout/prototype-page-styles";

type Props = {
  /** Signed-out visitors see sign-in oriented subtitle; subscribers see plan-oriented copy. */
  variant: "signedOut" | "plan";
};

/** Compact hero so pricing cards sit higher on the page. */
export function AiResearchLandingHeader({ variant }: Props) {
  const t = useTranslations("aiResearch.landing");

  return (
    <section className={prototypeNavyHeroSectionClass}>
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{ backgroundImage: PROTOTYPE_HERO_GRID_PATTERN }}
        aria-hidden
      />
      <div className="relative z-[1] mx-auto max-w-3xl px-4 py-5 text-center sm:px-6 sm:py-7">
        <p className={prototypeHeroEyebrowClass}>{t("eyebrow")}</p>
        <h1 className="heading mt-2 text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl md:text-3xl">
          {t("h1")}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
          {variant === "signedOut" ? t("heroSubtitleSignedOut") : t("heroSubtitle")}
        </p>
        {variant === "plan" ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            <a
              href="#ai-research-plans"
              className="inline-flex items-center gap-2 rounded-[6px] bg-[#C8922A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b07e22]"
            >
              <Search className="h-4 w-4" />
              {t("choosePlan")}
            </a>
            <Link
              href="/library"
              className="inline-flex items-center gap-2 rounded-[6px] border border-white/35 px-4 py-2 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10"
            >
              {t("browseLibrary")}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
