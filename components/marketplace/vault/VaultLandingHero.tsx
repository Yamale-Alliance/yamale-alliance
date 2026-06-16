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
  isSignedIn: boolean;
  cartCount: number;
  ownsLawFirmWorkspace: boolean;
  totalResources: number;
  freeResources: number;
  seriesCount: number;
  advisoryCourseHref?: string;
};

export function VaultLandingHero({
  search,
  onSearchChange,
  isSignedIn,
  cartCount,
  ownsLawFirmWorkspace,
  totalResources,
  freeResources,
  seriesCount,
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
      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pt-14 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className={prototypeHeroEyebrowClass}>{t("eyebrow")}</p>
            <h1 className="heading mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {t("landing.headline")}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              {t("landing.subheadline")}
            </p>

            <div className="relative mt-8 max-w-2xl">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t("landing.searchPlaceholder")}
                className="w-full rounded-xl border-0 bg-white py-3.5 pl-12 pr-4 text-base text-foreground shadow-xl outline-none ring-2 ring-transparent transition placeholder:text-muted-foreground focus:ring-[#C8922A]"
              />
            </div>

            <dl className="mt-8 flex flex-wrap gap-6 sm:gap-10">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  {t("landing.statResources")}
                </dt>
                <dd className="mt-1 text-2xl font-bold text-white">{totalResources}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  {t("landing.statFree")}
                </dt>
                <dd className="mt-1 text-2xl font-bold text-[#E8B84B]">{freeResources}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  {t("landing.statSeries")}
                </dt>
                <dd className="mt-1 text-2xl font-bold text-white">{seriesCount}</dd>
              </div>
            </dl>
          </div>

          {isSignedIn && (
            <div className="flex flex-wrap items-center gap-3 lg:pt-2">
              {ownsLawFirmWorkspace && courseHref && (
                <Link
                  href={courseHref}
                  className="inline-flex items-center gap-2 rounded-[6px] border border-[#C18C43]/50 bg-[#C18C43]/20 px-4 py-2.5 text-sm font-semibold text-[#E8B84B] backdrop-blur transition hover:bg-[#C18C43]/30"
                >
                  <GraduationCap className="h-5 w-5" aria-hidden />
                  <span>{tAdvisory("viewCourse")}</span>
                </Link>
              )}
              <Link
                href="/marketplace/purchased"
                className="inline-flex items-center gap-2 rounded-[6px] border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                <Package className="h-5 w-5 text-[#E8B84B]" />
                <span>{t("purchased")}</span>
              </Link>
              <Link
                href="/marketplace/cart"
                className="relative inline-flex items-center gap-2 rounded-[6px] border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                <ShoppingCart className="h-5 w-5 text-[#E8B84B]" />
                <span>{t("cart")}</span>
                {cartCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#C8922A] text-[10px] font-bold text-white">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
