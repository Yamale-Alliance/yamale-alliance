"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  lawFirmAdvisoryMailLinkProps,
  lawFirmTierEnrollmentMailLinkProps,
} from "@/lib/law-firm-enrollment-contact";
import { LawFirmPackageDiscountPrice } from "@/components/marketplace/LawFirmPackageDiscountPrice";
import { LawFirmDevelopmentSubnav } from "@/components/marketplace/law-firm-development-package/LawFirmDevelopmentSubnav";
import {
  LAW_FIRM_ADVISORY_WORKSPACE_HREF,
  LAW_FIRM_PACKAGE_SALE_PRICE_CENTS,
  LAW_FIRM_VIEW_COURSE_LABEL,
  LAW_FIRM_WORKSPACE_CTA_LABEL,
  LAW_FIRM_WORKSPACE_CTA_SHORT,
} from "@/lib/law-firm-package-marketing";

/**
 * Built-in sales landing for the African Law Firm Development ZIP package (converted from static HTML).
 * Sub-nav is portaled to document.body with fixed positioning below the site header.
 */

type Props = {
  /** Formatted sale price e.g. "$499.00" */
  priceDisplay: string;
  /** Sale price in cents for marketing strikeout (defaults to Tier 1 list price). */
  saleCents?: number;
  /** User already owns Tier 1 — CTAs show “Download” only and trigger file download. */
  owned: boolean;
  /** Signed-in, not owned: add to cart (if needed) and scroll to payment method + checkout. */
  onBeginPaidDownload: () => void | Promise<void>;
  /** Owned: start ZIP download */
  onOwnedDownload: () => void | Promise<void>;
  /** Owned: open ZIP listing preview (attachment-style). */
  onBrowseZipContents?: () => void;
  /** Implementation workspace URL (includes ?course= when item is a course). */
  courseWorkspaceHref?: string;
};

export function LawFirmDevelopmentZipLanding({
  priceDisplay,
  saleCents = LAW_FIRM_PACKAGE_SALE_PRICE_CENTS,
  owned,
  onBeginPaidDownload,
  onOwnedDownload,
  onBrowseZipContents,
  courseWorkspaceHref = LAW_FIRM_ADVISORY_WORKSPACE_HREF,
}: Props) {
  const showTier1Discount = !owned && priceDisplay !== "Free";
  const ownedFileLabel = "View & download";
  const navCtaLabel = owned ? ownedFileLabel : `Download — ${priceDisplay}`;
  const heroPrimaryLabel = owned ? ownedFileLabel : `Download Tier 1 — ${priceDisplay}`;
  const tier1CtaLabel = owned ? ownedFileLabel : `Download now — ${priceDisplay}`;
  const finalPrimaryLabel = owned ? ownedFileLabel : `Download Tier 1 — ${priceDisplay}`;

  const handlePrimaryFileAction = () => {
    if (owned) {
      onBrowseZipContents?.();
      return;
    }
    void onBeginPaidDownload();
  };

  const sectionScrollClass =
    "scroll-mt-[calc(var(--site-nav-h)+var(--vault-chrome-h))]";

  return (
    <div className="law-firm-package-landing bg-background [font-family:var(--font-lfp-sans),system-ui,sans-serif] text-[16px] leading-relaxed text-foreground">
      <LawFirmDevelopmentSubnav>
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
          <Link
            href="/marketplace"
            className="inline-flex shrink-0 items-center gap-1.5 text-[0.8rem] font-medium text-muted-foreground transition hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Vault</span>
          </Link>
          <span className="truncate [font-family:var(--font-lfp-serif),Georgia,serif] text-[1.05rem] font-semibold tracking-[0.04em] text-accent sm:text-[1.2rem]">
            Yamalé Advisory
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-4 sm:gap-8">
          <a href="#phases" className="hidden text-[0.85rem] font-medium uppercase tracking-[0.05em] text-muted-foreground transition hover:text-primary md:inline">
            What&apos;s inside
          </a>
          <a href="#tiers" className="hidden text-[0.85rem] font-medium uppercase tracking-[0.05em] text-muted-foreground transition hover:text-primary md:inline">
            Pricing
          </a>
          <a href="#about" className="hidden text-[0.85rem] font-medium uppercase tracking-[0.05em] text-muted-foreground transition hover:text-primary md:inline">
            About
          </a>
          {owned && (
            <Link
              href={courseWorkspaceHref}
              className="hidden rounded-[2px] border border-primary/40 bg-primary/10 px-3 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-primary transition hover:border-primary hover:bg-primary/15 sm:inline"
            >
              {LAW_FIRM_VIEW_COURSE_LABEL}
            </Link>
          )}
          <button
            type="button"
            onClick={handlePrimaryFileAction}
            className="rounded-[2px] bg-primary px-3 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-primary-foreground transition hover:bg-primary/90 sm:px-5 sm:text-[0.85rem]"
          >
            {navCtaLabel}
          </button>
        </div>
      </LawFirmDevelopmentSubnav>

      {owned && (
        <div className="relative z-[1] border-b border-border bg-primary/10">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-8 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Your Tier 1 package includes the online implementation workspace — track progress, browse
              documents, and use interactive tools.
            </p>
            <Link
              href={courseWorkspaceHref}
              className="inline-flex shrink-0 items-center justify-center rounded-[2px] bg-primary px-5 py-2.5 text-[0.8rem] font-semibold uppercase tracking-[0.05em] text-primary-foreground transition hover:bg-primary/90"
            >
              {LAW_FIRM_VIEW_COURSE_LABEL}
            </Link>
          </div>
        </div>
      )}

      <section className="relative flex min-h-screen items-center overflow-x-hidden pb-24 pt-10 sm:pt-12">
        <div className="pointer-events-none absolute inset-0 lfp-hero-glow" />
        <div className="relative z-[1] mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-16 px-8 lg:grid-cols-2 lg:gap-20">
          <div>
            <div className="mb-6 flex animate-[fadeUp_0.7s_ease_both] items-center gap-3 text-[0.75rem] font-medium uppercase tracking-[0.15em] text-primary">
              <span className="inline-block h-px w-8 bg-primary" />
              Yamalé Advisory · The Yamalé Vault
            </div>
            <h1 className="animate-[fadeUp_0.7s_0.15s_ease_both] [font-family:var(--font-lfp-serif),Georgia,serif] text-[clamp(3rem,5vw,4.5rem)] font-semibold leading-[1.05] text-foreground">
              The African Law Firm
              <em className="mt-1 block text-primary not-italic">Development Package</em>
            </h1>
            <p className="animate-[fadeUp_0.7s_0.25s_ease_both] mt-6 max-w-[480px] text-[1.05rem] leading-relaxed text-muted-foreground">
              150+ templates, frameworks, and guides — and four online courses — built from the ground up for OHADA and common
              law Africa. Not adapted. Not translated. Built here.
            </p>
            <div className="animate-[fadeUp_0.7s_0.35s_ease_both] mt-10 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handlePrimaryFileAction}
                className="inline-flex items-center gap-2 rounded-[2px] bg-primary px-8 py-3.5 text-[0.95rem] font-semibold tracking-[0.02em] text-primary-foreground transition hover:bg-primary/90"
              >
                {heroPrimaryLabel}
              </button>
              <a
                href="#tiers"
                className="inline-flex items-center gap-2 rounded-[2px] border border-border px-7 py-3.5 text-[0.95rem] font-medium text-foreground transition hover:border-primary hover:text-primary"
              >
                See all tiers
              </a>
              {owned && (
                <Link
                  href={courseWorkspaceHref}
                  className="inline-flex items-center gap-2 rounded-[2px] border border-primary/40 px-7 py-3.5 text-[0.95rem] font-medium text-primary transition hover:border-primary hover:bg-primary/8"
                >
                  {LAW_FIRM_VIEW_COURSE_LABEL}
                </Link>
              )}
            </div>
          </div>

          <div className="animate-[fadeUp_0.7s_0.2s_ease_both] relative rounded-[4px] border border-border bg-card p-10 shadow-sm before:absolute before:left-0 before:right-0 before:top-0 before:h-[3px] before:rounded-t-[4px] before:bg-gradient-to-r before:from-primary before:to-primary/70">
            <div className="mb-8 grid grid-cols-2 gap-8">
              {[
                ["150+", "Documents"],
                ["8", "Phases"],
                ["46", "Sections"],
                ["4", "Courses"],
              ].map(([n, l]) => (
                <div key={l} className="text-center">
                  <span className="[font-family:var(--font-lfp-serif),Georgia,serif] block text-[3rem] font-bold leading-none text-primary">
                    {n}
                  </span>
                  <span className="mt-2 block text-[0.78rem] uppercase tracking-[0.08em] text-muted-foreground">{l}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-6 text-center">
              <div className="mb-2 text-[0.75rem] uppercase tracking-[0.1em] text-muted-foreground">Tier 1 — Self-Service Library</div>
              <div className="[font-family:var(--font-lfp-serif),Georgia,serif] text-[3.5rem] font-bold leading-none">
                {showTier1Discount ? (
                  <LawFirmPackageDiscountPrice
                    saleCents={saleCents}
                    tone="light"
                    size="hero"
                    className="justify-center [&>div>span:nth-child(2)]:text-[3.5rem] [&>div>span:nth-child(2)]:leading-none [&>div>span:first-child]:text-[1.75rem]"
                  />
                ) : (
                  <span className="text-primary">{priceDisplay}</span>
                )}
              </div>
              <div className="mt-2 text-[0.8rem] text-muted-foreground">One-time download · Immediate full access</div>
            </div>
          </div>
        </div>
      </section>

      <section id="why" className={`bg-[#221913] py-24 ${sectionScrollClass}`}>
        <div className="mx-auto max-w-[1120px] px-8">
          <div className="mb-4 flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#C18C43]">
            <span className="h-px w-6 bg-[#C18C43]" />
            The challenge
          </div>
          <h2 className="mb-5 max-w-[680px] [font-family:var(--font-lfp-serif),Georgia,serif] text-[clamp(2rem,3.5vw,3rem)] font-semibold text-white">
            Built for African law firms. Not adapted for them.
          </h2>
          <p className="mb-16 max-w-[620px] text-[1rem] leading-relaxed text-white/65">
            African lawyers are trained to be expert advocates. They are not trained to manage law firms. This package fills that
            gap — giving you everything you need to get your firm launched and organised so you can focus on the things you and
            your team are actually good at.
          </p>
          <div className="grid gap-px border border-[rgba(193,140,67,0.15)] bg-[rgba(193,140,67,0.15)] sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["01", "OHADA and common law, together", "Every document accounts for both legal traditions."],
              ["02", "Multi-currency billing", "Currency instability, withholding tax, capital controls — the full billing reality."],
              ["03", "Infrastructure-aware operations", "Power backup, dual-provider internet — built for African infrastructure realities."],
              ["04", "Talent in a constrained market", "Retention strategies and compensation benchmarking for African legal talent markets."],
              ["05", "Government relationships", "Policies and frameworks for the most complex stakeholder category."],
              ["06", "54 jurisdictions, one framework", "ECOWAS, SADC, EAC, AfCFTA, BITs — a single framework covering all of it."],
            ].map(([num, title, desc]) => (
              <div key={num} className="bg-[#221913] p-8 transition hover:bg-[rgba(96,59,28,0.3)]">
                <div className="mb-4 [font-family:var(--font-lfp-serif),Georgia,serif] text-[3.5rem] font-bold leading-none text-[rgba(193,140,67,0.2)]">
                  {num}
                </div>
                <div className="mb-3 text-[1rem] font-semibold text-white">{title}</div>
                <p className="text-[0.875rem] leading-relaxed text-white/55">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="phases" className={`border-y border-[rgba(193,140,67,0.1)] bg-white/[0.02] py-24 ${sectionScrollClass}`}>
        <div className="mx-auto max-w-[1120px] px-8">
          <div className="mb-16 grid gap-12 lg:grid-cols-2">
            <div>
              <div className="mb-4 flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#C18C43]">
                <span className="h-px w-6 bg-[#C18C43]" />
                What&apos;s inside
              </div>
              <h2 className="mb-5 max-w-[680px] [font-family:var(--font-lfp-serif),Georgia,serif] text-[clamp(2rem,3.5vw,3rem)] font-semibold">
                Eight phases of law firm development
              </h2>
              <p className="max-w-[620px] text-[1rem] leading-relaxed text-white/65">
                Every document in the package is deployable on day one. These are not frameworks to complete later — they are
                tools ready to adapt and use.
              </p>
            </div>
            <div>
              <p className="max-w-full text-[1rem] leading-relaxed text-white/65">
                Tier 1 documents are included in the {priceDisplay} download. Tier 2 items — the four online courses and five
                specialist series — require Tier 2 access.
              </p>
              <div className="mt-4 flex flex-wrap gap-4">
                <span className="flex items-center gap-2 text-[0.8rem] text-white/60">
                  <span className="rounded-[2px] bg-[rgba(193,140,67,0.15)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#C18C43]">
                    Tier 1
                  </span>
                  Included at {priceDisplay}
                </span>
                <span className="flex items-center gap-2 text-[0.8rem] text-white/60">
                  <span className="rounded-[2px] bg-[rgba(96,59,28,0.5)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#E3BA65]">
                    Tier 2
                  </span>
                  Guided implementation
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-px bg-[rgba(193,140,67,0.12)]">
            {[
              ["1", "Foundational Business Infrastructure", "Strategic planning, governance, financial systems, billing and collections.", "Tier 1"],
              ["2", "Human Resources & Talent Management", "HR manual, recruitment, onboarding, performance, compensation.", "Tier 1"],
              ["3", "Operations & Technology", "Technology roadmap, data security, cloud migration, software setup guides.", "Tier 1"],
              ["4", "Business Development & Client Relations", "Marketing strategy, digital toolkit, BD tools, branding.", "Tier 1"],
              ["5", "Risk Management & Compliance", "Ethics, risk framework, regulatory compliance, vendor management.", "Tier 1"],
              ["6", "Practice Area Development", "Practice leadership, matter economics — plans in Tier 2.", "Tier 1 + 2"],
              ["7", "Growth & Expansion", "Multi-office, partnerships — growth workbook in Tier 2.", "Tier 1 + 2"],
              ["8", "Specialized African Context", "Language, regional compliance — multi-jurisdictional series in Tier 2.", "Tier 1 + 2"],
            ].map(([num, name, desc, badge]) => (
              <div
                key={num}
                className="grid cursor-default grid-cols-[auto_1fr_auto] items-start gap-6 border-l-[3px] border-transparent bg-[#221913] px-8 py-6 transition hover:border-[#C18C43] hover:bg-[rgba(96,59,28,0.25)]"
              >
                <div className="min-w-[2rem] pt-0.5 [font-family:var(--font-lfp-serif),Georgia,serif] text-[1.4rem] font-bold text-[#C18C43]">
                  {num}
                </div>
                <div>
                  <div className="mb-1 text-[0.95rem] font-medium text-white">{name}</div>
                  <div className="text-[0.825rem] leading-normal text-white/50">{desc}</div>
                </div>
                <span
                  className={`mt-0.5 whitespace-nowrap rounded-[2px] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] ${
                    badge.includes("Tier 1") && !badge.includes("+")
                      ? "bg-[rgba(193,140,67,0.15)] text-[#C18C43]"
                      : "bg-[rgba(96,59,28,0.5)] text-[#E3BA65]"
                  }`}
                >
                  {badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="courses" className={`bg-[#221913] py-24 ${sectionScrollClass}`}>
        <div className="mx-auto max-w-[1120px] px-8">
          <div className="mb-4 flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#C18C43]">
            <span className="h-px w-6 bg-[#C18C43]" />
            Four online courses
          </div>
          <h2 className="mb-5 max-w-[680px] [font-family:var(--font-lfp-serif),Georgia,serif] text-[clamp(2rem,3.5vw,3rem)] font-semibold">
            Included in Tier 2
          </h2>
          <p className="mb-12 max-w-[620px] text-[1rem] leading-relaxed text-white/65">
            Workbook-based learning programmes written for practicing lawyers and firm leaders — grounded in African legal
            practice realities.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              ["01", "Law Firm Financial Management Fundamentals", "Financial systems, billing, collections, cash flow — 8 modules."],
              ["02", "Building a High-Performance Legal Team", "Hiring, onboarding, performance, compensation — 8 modules."],
              ["03", "Technology Essentials for Modern Law Firms", "Cybersecurity, vendors, AI in context — 8 modules."],
              ["04", "Business Development for African Law Firms", "Positioning, acquisition, pricing — 5 modules."],
            ].map(([num, title, desc]) => (
              <div
                key={num}
                className="relative rounded-[3px] border border-[rgba(193,140,67,0.15)] bg-white/[0.03] p-8 transition hover:border-[rgba(193,140,67,0.4)]"
              >
                <span className="absolute right-5 top-5 rounded-[2px] bg-[rgba(96,59,28,0.5)] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#E3BA65]">
                  Tier 2
                </span>
                <div className="mb-3 [font-family:var(--font-lfp-serif),Georgia,serif] text-[2.5rem] font-bold leading-none text-[rgba(193,140,67,0.25)]">
                  {num}
                </div>
                <div className="mb-2 text-[1.05rem] font-semibold text-white">{title}</div>
                <p className="mb-4 text-[0.85rem] leading-relaxed text-white/55">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tiers" className={`bg-[#221913] py-24 ${sectionScrollClass}`}>
        <div className="mx-auto max-w-[1120px] px-8">
          <div className="mb-4 flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#C18C43]">
            <span className="h-px w-6 bg-[#C18C43]" />
            Pricing
          </div>
          <h2 className="mb-5 max-w-[680px] [font-family:var(--font-lfp-serif),Georgia,serif] text-[clamp(2rem,3.5vw,3rem)] font-semibold">
            Choose your access level
          </h2>
          <p className="mb-16 max-w-[620px] text-[1rem] text-white/65">
            Start with the library and expand when you&apos;re ready. Every tier builds on the one before it.
          </p>
          <div className="mx-auto grid max-w-[480px] gap-6 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            <div className="rounded-[3px] border border-[rgba(193,140,67,0.15)] transition hover:-translate-y-1 hover:border-[rgba(193,140,67,0.35)]">
              <div className="border-b border-[rgba(193,140,67,0.1)] px-8 pb-6 pt-8">
                <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.15em] text-[#C18C43]">Tier 1</div>
                <div className="mb-5 text-[1.3rem] font-semibold text-white">Self-Service Library</div>
                <div className="[font-family:var(--font-lfp-serif),Georgia,serif] text-[2.75rem] font-bold leading-none">
                  {showTier1Discount ? (
                    <LawFirmPackageDiscountPrice
                      saleCents={saleCents}
                      tone="dark"
                      size="hero"
                      className="[&>div>span:nth-child(2)]:text-[2.75rem] [&>div>span:nth-child(2)]:leading-none [&>div>span:first-child]:text-[1.35rem]"
                    />
                  ) : (
                    <span className="text-[#E3BA65]">{priceDisplay}</span>
                  )}
                </div>
                <div className="mt-2 text-[0.8rem] text-white/45">One-time download from the Yamalé Vault</div>
              </div>
              <div className="px-8 pb-8 pt-7">
                <ul className="mb-8 flex flex-col gap-3">
                  {[
                    "All 150+ templates, checklists, and guides",
                    "All 8 phases of the framework",
                    "OHADA and common law versions throughout",
                    "Immediate, full access on download",
                    "Regular content updates",
                  ].map((li) => (
                    <li key={li} className="flex gap-3 text-[0.875rem] leading-snug text-white/70">
                      <span className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-[#C18C43]" />
                      {li}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={handlePrimaryFileAction}
                  className="block w-full rounded-[2px] bg-[#C18C43] py-3.5 text-center text-[0.9rem] font-semibold text-[#221913] transition hover:bg-[#E3BA65]"
                >
                  {tier1CtaLabel}
                </button>
              </div>
            </div>

            <div className="rounded-[3px] border border-[#C18C43] transition hover:-translate-y-1">
              <div className="bg-[#C18C43] py-2 text-center text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#221913]">
                Most popular
              </div>
              <div className="border-b border-[rgba(193,140,67,0.1)] px-8 pb-6 pt-8">
                <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.15em] text-[#C18C43]">Tier 2</div>
                <div className="mb-5 text-[1.3rem] font-semibold text-white">Guided Implementation</div>
                <div className="[font-family:var(--font-lfp-serif),Georgia,serif] text-[2.75rem] font-bold leading-none text-[#E3BA65]">
                  $2,500–$5,000
                </div>
                <div className="mt-2 text-[0.8rem] text-white/45">Contact Yamalé Advisory to enroll</div>
              </div>
              <div className="px-8 pb-8 pt-7">
                <ul className="mb-8 flex flex-col gap-3 text-[0.875rem] leading-snug text-white/70">
                  <li className="flex gap-3">
                    <span className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-[#C18C43]" />
                    Everything in Tier 1 plus courses, practice plans, workbooks, community, and guided timeline.
                  </li>
                </ul>
                <a
                  {...lawFirmTierEnrollmentMailLinkProps(2)}
                  className="block w-full rounded-[2px] bg-[#C18C43] py-3.5 text-center text-[0.9rem] font-semibold text-[#221913] transition hover:bg-[#E3BA65]"
                >
                  Contact us to enroll
                </a>
              </div>
            </div>

            <div className="rounded-[3px] border border-[rgba(193,140,67,0.15)] transition hover:-translate-y-1 hover:border-[rgba(193,140,67,0.35)]">
              <div className="border-b border-[rgba(193,140,67,0.1)] px-8 pb-6 pt-8">
                <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.15em] text-[#C18C43]">Tier 3</div>
                <div className="mb-5 text-[1.3rem] font-semibold text-white">Guided Implementation with Yamalé</div>
                <div className="[font-family:var(--font-lfp-serif),Georgia,serif] text-[2.75rem] font-bold leading-none text-[#E3BA65]">
                  $10,000–$25,000
                </div>
                <div className="mt-2 text-[0.8rem] text-white/45">Annual engagement</div>
              </div>
              <div className="px-8 pb-8 pt-7">
                <ul className="mb-8 flex flex-col gap-3 text-[0.875rem] leading-snug text-white/70">
                  <li className="flex gap-3">
                    <span className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-[#C18C43]" />
                    Everything in Tiers 1 &amp; 2, consulting hours, customisation, on-site assessment where applicable.
                  </li>
                </ul>
                <a
                  {...lawFirmTierEnrollmentMailLinkProps(3)}
                  className="block w-full rounded-[2px] border border-[rgba(193,140,67,0.3)] py-3.5 text-center text-[0.9rem] font-semibold text-[#C18C43] transition hover:border-[#C18C43] hover:text-[#E3BA65]"
                >
                  Enquire about Tier 3
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="roadmap" className={`border-y border-[rgba(193,140,67,0.1)] bg-white/[0.02] py-24 ${sectionScrollClass}`}>
        <div className="mx-auto max-w-[1120px] px-8">
          <div className="mb-4 flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#C18C43]">
            <span className="h-px w-6 bg-[#C18C43]" />
            Tier 3 — Guided Implementation
          </div>
          <h2 className="mb-5 max-w-[680px] [font-family:var(--font-lfp-serif),Georgia,serif] text-[clamp(2rem,3.5vw,3rem)] font-semibold">
            From assessment to optimisation in 12 months
          </h2>
          <p className="mb-16 max-w-[620px] text-[1rem] text-white/65">
            Tier 3 clients work directly with Yamalé Advisory through a structured roadmap — foundational systems before growth
            and specialisation.
          </p>
          <div className="relative flex flex-col before:absolute before:left-9 before:top-0 before:h-full before:w-px before:bg-gradient-to-b before:from-transparent before:via-[rgba(193,140,67,0.3)] before:to-transparent max-md:before:left-7">
            {[
              ["Months 1–2", "Assessment & Foundation", "Prioritise needs, establish financial tracking, document processes."],
              ["Months 3–4", "Core Operations", "HR policies, file management, standard client templates."],
              ["Months 5–6", "Financial & Technology Systems", "Billing, time tracking, controls that protect revenue."],
              ["Months 7–9", "Growth & Development", "Marketing, performance management, strategic planning."],
              ["Months 10–12", "Optimisation & Scale", "Review systems, plan growth, measure impact."],
            ].map(([time, title, desc]) => (
              <div key={title} className="grid grid-cols-[4.5rem_1fr] gap-8 border-b border-[rgba(193,140,67,0.08)] py-8 last:border-b-0 md:grid-cols-[4.5rem_1fr]">
                <div className="flex flex-col items-center gap-2 pt-1">
                  <div className="z-[1] h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-[#221913] bg-[#C18C43] shadow-[0_0_0_1px_#C18C43]" />
                  <div className="text-center text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-[#C18C43]">{time}</div>
                </div>
                <div>
                  <div className="mb-2 text-[1.05rem] font-semibold text-white">{title}</div>
                  <p className="text-[0.875rem] leading-relaxed text-white/55">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[rgba(193,140,67,0.1)] bg-[#221913] py-16">
        <div className="mx-auto max-w-[1120px] px-8">
          <div className="mb-4 flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#C18C43]">
            <span className="h-px w-6 bg-[#C18C43]" />
            À la carte services
          </div>
          <h2 className="mb-5 [font-family:var(--font-lfp-serif),Georgia,serif] text-[2rem] font-semibold">Need something specific?</h2>
          <p className="mb-10 max-w-[620px] text-[1rem] text-white/65">
            Individual consulting, bespoke documents, and training — separately negotiated to match what your firm needs now.
          </p>
          <div className="grid gap-px bg-[rgba(193,140,67,0.12)] sm:grid-cols-3">
            {[
              ["Advisory", "Consulting hours on strategy, management, or cross-border practice."],
              ["Custom documents", "Templates and policies tailored to your jurisdiction and structure."],
              ["Training & assessments", "On-site or remote training, audits, and readiness reviews."],
            ].map(([h, b]) => (
              <div key={h} className="bg-[#221913] p-7">
                <div className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#C18C43]">{h}</div>
                <p className="text-[0.9rem] leading-relaxed text-white/70">{b}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <a
              {...lawFirmAdvisoryMailLinkProps()}
              className="inline-flex rounded-[2px] border border-[rgba(193,140,67,0.4)] px-7 py-3.5 text-[0.95rem] font-medium text-[#C18C43] transition hover:border-[#C18C43] hover:text-[#E3BA65]"
            >
              Discuss your needs with Yamalé Advisory
            </a>
          </div>
        </div>
      </section>

      <section id="about" className={`bg-[#221913] py-24 ${sectionScrollClass}`}>
        <div className="mx-auto max-w-[1120px] px-8">
          <div className="mb-4 flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#C18C43]">
            <span className="h-px w-6 bg-[#C18C43]" />
            About Yamalé
          </div>
          <div className="mt-16 grid gap-16 lg:grid-cols-2 lg:items-center">
            <blockquote className="border-l-[3px] border-[#C18C43] pl-8 [font-family:var(--font-lfp-serif),Georgia,serif] text-[1.75rem] italic leading-snug text-[#E3BA65]">
              &ldquo;African institutions deserve sophisticated, world-class support — built from within Africa, not imported.&rdquo;
            </blockquote>
            <div className="space-y-4 text-[0.95rem] leading-relaxed text-white/65">
              <p>
                Yamalé Advisory SARL is a commercial advisory firm registered in Senegal, operating across all 54 African
                countries — working with firms, governments, SMEs, and investors on sustainable growth infrastructure.
              </p>
              <p>
                Yamalé Alliance, our nonprofit foundation, strengthens legal infrastructure, mineral sovereignty, and equitable
                contracts alongside governments and communities.
              </p>
              <p>The Law Firm Development Package was built by African legal and management practitioners.</p>
              <div className="h-0.5 w-[60px] bg-[#C18C43]" />
              <p className="text-[0.875rem] text-[#9A632A]">Dakar, Senegal · yamalealliance.org</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#603B1C] via-[#221913] to-[#221913] py-32 text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-80 lfp-hero-glow"
        />
        <div className="relative z-[1] mx-auto max-w-[1120px] px-8">
          <h2 className="mb-4 [font-family:var(--font-lfp-serif),Georgia,serif] text-[clamp(2.5rem,5vw,4rem)] font-semibold text-white">
            Get the package
          </h2>
          <p className="mb-10 text-[1.1rem] text-white/60">
            150+ documents, built for African law firms — available from the Yamalé Vault.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={handlePrimaryFileAction}
              className="inline-flex items-center gap-2 rounded-[2px] bg-[#C18C43] px-8 py-3.5 text-[0.95rem] font-semibold text-[#221913] transition hover:bg-[#E3BA65]"
            >
              {finalPrimaryLabel}
            </button>
            <a
              {...lawFirmAdvisoryMailLinkProps()}
              className="inline-flex items-center gap-2 rounded-[2px] border border-[rgba(193,140,67,0.4)] px-7 py-3.5 text-[0.95rem] font-medium text-[#C18C43] transition hover:border-[#C18C43]"
            >
              Tier 2 &amp; 3 enquiries
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-[rgba(193,140,67,0.1)] bg-black/40 py-10">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-8">
          <div className="[font-family:var(--font-lfp-serif),Georgia,serif] text-[1rem] text-[#C18C43]">Yamalé Advisory</div>
          <div className="text-[0.8rem] text-white/35">
            © {new Date().getFullYear()} Yamalé Advisory SARL · Dakar, Senegal · yamalealliance.org
          </div>
        </div>
      </footer>

      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}`,
        }}
      />
    </div>
  );
}
