"use client";

import Link from "next/link";
import { Search, ShoppingCart, Package, GraduationCap } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  PROTOTYPE_HERO_GRID_PATTERN,
  prototypeHeroEyebrowClass,
  prototypeNavyHeroSectionClass,
} from "@/components/layout/prototype-page-styles";

type VaultLandingHeroProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onBrowseAll: () => void;
  isSignedIn: boolean;
  cartCount: number;
  ownsLawFirmWorkspace: boolean;
  advisoryCourseHref?: string;
};

export function VaultLandingHero({
  search,
  onSearchChange,
  onSearchSubmit,
  onBrowseAll,
  isSignedIn,
  cartCount,
  ownsLawFirmWorkspace,
  advisoryCourseHref: courseHref,
}: VaultLandingHeroProps) {
  const t = useTranslations("marketplace");
  const tAdvisory = useTranslations("advisory");

  return (
    <section className={`relative overflow-hidden ${prototypeNavyHeroSectionClass}`}>
      <div
        className="absolute inset-0 z-0"
        style={{ backgroundImage: PROTOTYPE_HERO_GRID_PATTERN }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-[1140px] px-6 py-11 text-center sm:py-14">
        <p className={prototypeHeroEyebrowClass}>{t("eyebrow")}</p>
        <h1 className="heading mt-3 text-[2rem] font-bold leading-tight tracking-tight text-white sm:text-[2.15rem]">
          {t("landing.headline")}
        </h1>
        <p className="mx-auto mt-2.5 max-w-[44ch] text-[0.98rem] leading-relaxed text-white/75">
          {t("landing.subheadline")}
        </p>

        <form
          className="mx-auto mt-6 flex max-w-[500px] items-center gap-2 rounded-[10px] bg-white py-1 pl-4 pr-1.5 shadow-lg"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
        >
          <Search
            className="h-4 w-4 shrink-0 text-[color:var(--primary)]"
            aria-hidden
            strokeWidth={2}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("landing.searchPlaceholder")}
            className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-[0.95rem] text-[color:var(--brand-navy-fixed)] outline-none placeholder:text-[color:var(--muted-foreground)] caret-[color:var(--brand-navy-fixed)]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[linear-gradient(135deg,var(--brand-copper),var(--primary))] px-4 py-2 text-sm font-bold text-white transition hover:brightness-105"
          >
            {t("landing.searchCta")}
          </button>
        </form>

        <button
          type="button"
          onClick={onBrowseAll}
          className="mt-4 text-[0.88rem] font-medium text-[color:var(--brand-pale-gold)] transition hover:text-white"
        >
          {t("landing.browseCatalogLink")}
        </button>

        {isSignedIn ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {ownsLawFirmWorkspace && courseHref ? (
              <Link
                href={courseHref}
                className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                <GraduationCap className="h-4 w-4 text-[color:var(--brand-pale-gold)]" aria-hidden />
                <span>{tAdvisory("viewCourse")}</span>
              </Link>
            ) : null}
            <Link
              href="/marketplace/purchased"
              className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
            >
              <Package className="h-4 w-4 text-[color:var(--brand-pale-gold)]" aria-hidden />
              <span>{t("purchased")}</span>
            </Link>
            <Link
              href="/marketplace/cart"
              className="relative inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
            >
              <ShoppingCart className="h-4 w-4 text-[color:var(--brand-pale-gold)]" aria-hidden />
              <span>{t("cart")}</span>
              {cartCount > 0 ? (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--primary)] text-[10px] font-bold text-white">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              ) : null}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
