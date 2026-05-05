"use client";

import Link from "next/link";
import {
  PROTOTYPE_HERO_GRID_PATTERN,
  prototypeHeroEyebrowClass,
  prototypeNavyHeroSectionClass,
} from "@/components/layout/prototype-page-styles";
import { AccountUnlockedLawyers } from "@/components/account/AccountUnlockedLawyers";

/** Marketing-style entry; same data as Account → Unlocked lawyers. */
export default function UnlockedLawyersPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className={prototypeNavyHeroSectionClass}>
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundImage: PROTOTYPE_HERO_GRID_PATTERN }}
          aria-hidden
        />
        <div className="relative z-[1] mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <p className={prototypeHeroEyebrowClass}>
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8B84B] shadow-[0_0_0_4px_rgba(200,146,42,0.2)]" />
            Lawyers Directory
          </p>
          <h1 className="heading mt-6 text-3xl font-bold tracking-tight text-white">Unlocked lawyers</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/[0.62]">
            Lawyers whose contact details you have already paid to unlock.
          </p>
          <div className="mt-6">
            <Link
              href="/lawyers"
              className="inline-flex items-center rounded-[6px] border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/18"
            >
              Back to lawyers search
            </Link>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AccountUnlockedLawyers />
        </div>
      </section>
    </div>
  );
}
