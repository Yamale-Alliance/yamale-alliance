"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PlatformLogo } from "@/components/platform/PlatformLogo";
import { ArrowUpRight, Mail } from "lucide-react";
import { PLATFORM_BUSINESS_EMAIL } from "@/lib/platform-emails";

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[14px] text-white/55 transition hover:text-primary dark:text-white/55 dark:hover:text-primary"
    >
      {children}
    </Link>
  );
}

function LinkGroup({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-white/35">{title}</p>
      <ul className="flex flex-col gap-2.5">
        {links.map(({ href, label }) => (
          <li key={href}>
            <FooterLink href={href}>{label}</FooterLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  const productLinks = [
    { href: "/library", label: t("legalLibrary") },
    { href: "/afcfta/compliance-check", label: t("afcftaTools") },
    { href: "/ai-research", label: t("aiResearch") },
    { href: "/marketplace", label: t("vault") },
    { href: "/lawyers", label: t("findLawyer") },
  ];

  const companyLinks = [
    { href: "/founders-note", label: t("foundersNote") },
    { href: "/pricing", label: t("pricing") },
    { href: "/signup", label: t("signUp") },
    { href: "/login", label: t("signIn") },
  ];

  const legalLinks = [
    { href: "/privacy", label: t("privacy") },
    { href: "/terms", label: t("terms") },
    { href: "/payment-refund", label: t("paymentRefunds") },
  ];

  return (
    <footer className="yamale-site-footer mt-auto print:hidden" role="contentinfo">
      <div className="bg-[#0D1B2A] px-4 pb-12 pt-14 text-white sm:px-8">
        <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
          <div className="max-w-md">
            <Link href="/" className="inline-block opacity-95 transition hover:opacity-100" aria-label={t("homeAria")}>
              <PlatformLogo height={64} width={220} className="h-14 w-[220px]" />
            </Link>
            <p className="heading mt-6 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem] sm:leading-snug">
              {t("tagline")}
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-white/45">{t("description")}</p>
          </div>
          <LinkGroup title={t("product")} links={productLinks} />
          <LinkGroup title={t("company")} links={companyLinks} />
          <LinkGroup title={t("legal")} links={legalLinks} />
        </div>

        <div className="mx-auto mt-10 max-w-[920px] border-t border-white/[0.08] pt-8 text-[12px] leading-[1.7] text-white/40">
          <p>
            <strong className="font-semibold text-white/[0.65]">{t("disclaimerImportant")}</strong> {t("disclaimerBody")}{" "}
            <Link href="/lawyers" className="text-[#E8B84B] underline underline-offset-2 hover:text-[#E8B84B]/90">
              {t("qualifiedCounsel")}
            </Link>{" "}
            {t("disclaimerBeforeDecisions")}
          </p>
          <p className="mt-3">
            {t("termsAgree")} <FooterLink href="/terms">{t("terms")}</FooterLink>,{" "}
            <FooterLink href="/privacy">{t("privacyPolicy")}</FooterLink>, {t("and")}{" "}
            <FooterLink href="/payment-refund">{t("paymentRefundPolicy")}</FooterLink>. {t("dataNotice")}
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#0D1B2A] px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-6 sm:flex-row sm:justify-between sm:gap-4">
          <a
            href={`mailto:${PLATFORM_BUSINESS_EMAIL}`}
            className="group inline-flex items-center gap-2 rounded-[6px] border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:border-primary/50 hover:bg-white/10"
          >
            <Mail className="h-4 w-4 text-primary" />
            <span>{PLATFORM_BUSINESS_EMAIL}</span>
            <ArrowUpRight className="h-4 w-4 text-primary opacity-80 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
          <p className="text-center text-xs text-white/45 sm:text-left">{t("copyright", { year })}</p>
        </div>
      </div>
    </footer>
  );
}
