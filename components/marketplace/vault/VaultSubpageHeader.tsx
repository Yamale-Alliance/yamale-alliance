"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  PROTOTYPE_HERO_GRID_PATTERN,
  prototypeNavyHeroSectionClass,
} from "@/components/layout/prototype-page-styles";

type VaultSubpageHeaderProps = {
  backHref?: string;
  backLabel: string;
  title: string;
  subtitle?: string;
};

export function VaultSubpageHeader({
  backHref = "/marketplace",
  backLabel,
  title,
  subtitle,
}: VaultSubpageHeaderProps) {
  return (
    <section className={`relative overflow-hidden border-b border-border ${prototypeNavyHeroSectionClass}`}>
      <div
        className="absolute inset-0 z-0"
        style={{ backgroundImage: PROTOTYPE_HERO_GRID_PATTERN }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
        <h1 className="heading mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">{subtitle}</p>
        ) : null}
      </div>
    </section>
  );
}
