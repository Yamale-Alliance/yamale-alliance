import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { HomeDashboardLink } from "@/components/home/HomeDashboardLink";
import { PROTOTYPE_HERO_GRID_PATTERN } from "@/components/layout/prototype-page-styles";
import { createHomeMetadata } from "@/lib/site-seo";

/** Home page reads locale cookie for translated marketing copy. */
export const dynamic = "force-dynamic";

export const metadata = createHomeMetadata();

export default async function Home() {
  const t = await getTranslations("home");

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b border-border bg-[#0D1B2A]">
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundImage: PROTOTYPE_HERO_GRID_PATTERN }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -bottom-16 -right-10 z-0 h-[480px] w-[480px] text-white opacity-[0.06]" aria-hidden>
          <svg viewBox="0 0 300 360" className="h-full w-full" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M145 10 C120 10 100 25 88 45 C75 65 72 90 68 110 C62 140 50 155 45 175 C38 200 40 225 50 248 C62 274 82 292 100 310 C118 328 135 345 152 355 C160 360 168 358 175 350 C185 338 188 320 192 302 C198 278 205 255 218 235 C230 218 245 205 252 188 C262 165 258 138 248 118 C238 98 222 85 210 68 C198 50 192 30 175 18 C165 12 155 10 145 10Z" />
          </svg>
        </div>

        <div className="relative z-[1] mx-auto w-full max-w-[1280px] px-4 pb-6 pt-16 sm:px-8 sm:pb-8 sm:pt-20">
          <h1 className="hero-lcp-title max-w-[680px] text-[2.75rem] font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl md:text-[56px] lg:text-[62px]">
            {t("heroTitle1")}
            <br />
            <em className="not-italic text-[#E8B84B]">{t("heroTitle2")}</em>
          </h1>

          <div className="mt-7 inline-flex items-center gap-2.5 rounded-full border border-[rgba(200,146,42,0.22)] bg-[rgba(200,146,42,0.08)] px-3.5 py-2 text-[13px] font-semibold tracking-[0.02em] text-[#E8B84B]">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8B84B] shadow-[0_0_0_4px_rgba(200,146,42,0.2)]" />
            {t("heroBadge")}
          </div>

          <p className="mt-7 max-w-[520px] text-lg leading-relaxed text-white/[0.65]">{t("heroSubtitle")}</p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/library"
              className="inline-flex items-center gap-2 rounded-[6px] bg-[#C8922A] px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#b07e22]"
            >
              <BookOpen className="h-4 w-4" strokeWidth={2} />
              {t("browseLibrary")}
            </Link>
            <Link
              href="/ai-research"
              prefetch
              className="inline-flex items-center gap-2 rounded-[6px] border-[1.5px] border-white/40 bg-transparent px-6 py-3 text-base font-semibold text-white transition hover:border-white hover:bg-white hover:text-[#0D1B2A]"
            >
              <Search className="h-4 w-4" strokeWidth={2} />
              {t("tryAiResearch")}
            </Link>
            <HomeDashboardLink />
          </div>

          <div className="mt-10 flex flex-wrap gap-x-10 gap-y-6 border-t border-white/10 pt-6 md:gap-x-14">
            <div>
              <div className="heading text-[28px] font-bold leading-none text-[#E8B84B] md:text-[32px]">54</div>
              <div className="mt-1 text-[13px] text-white/50">{t("statCountries")}</div>
            </div>
            <div>
              <div className="heading text-[28px] font-bold leading-none text-[#E8B84B] md:text-[32px]">3000+</div>
              <div className="mt-1 text-[13px] text-white/50">{t("statLaws")}</div>
            </div>
            <div>
              <div className="heading text-[28px] font-bold leading-none text-[#E8B84B] md:text-[32px]">{t("statAiValue")}</div>
              <div className="mt-1 text-[13px] text-white/50">{t("statAiLabel")}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-10 gap-y-3 border-t border-white/10 pt-5 sm:gap-x-12">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-white/40">{t("trustedBy")}</span>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm font-semibold text-white/60">
              <span>{t("trustedLawFirms")}</span>
              <span>{t("trustedGovernments")}</span>
              <span>{t("trustedMining")}</span>
              <span>{t("trustedDev")}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0D1B2A] px-4 py-10 sm:px-8">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#E8B84B]">{t("foundersEyebrow")}</p>
            <h2 className="heading mt-1 text-xl font-semibold text-white sm:text-2xl">{t("foundersTitle")}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">{t("foundersBody")}</p>
          </div>
          <Link
            href="/founders-note"
            className="inline-flex shrink-0 items-center justify-center rounded-[6px] border border-[#C8922A]/50 bg-[#C8922A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b07e22]"
          >
            {t("foundersCta")}
          </Link>
        </div>
      </section>

      <section className="border-b border-border bg-background px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="mx-auto mb-12 max-w-[560px] text-center">
            <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.5px] text-[#C8922A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C8922A]" />
              {t("platformEyebrow")}
            </p>
            <h2 className="heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("platformTitle")}</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">{t("platformSubtitle")}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard href="/library" title={t("featureLibraryTitle")} description={t("featureLibraryDesc")} cta={t("featureLibraryCta")} />
            <FeatureCard href="/ai-research" title={t("featureAiTitle")} description={t("featureAiDesc")} cta={t("featureAiCta")} />
            <FeatureCard href="/marketplace" title={t("featureVaultTitle")} description={t("featureVaultDesc")} cta={t("featureVaultCta")} />
            <FeatureCard
              href="/lawyers"
              title={t("featureLawyersTitle")}
              description={t("featureLawyersDesc")}
              cta={t("featureLawyersCta")}
              className="sm:col-span-2 lg:col-span-1"
            />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t-[3px] border-[#C8922A] bg-gradient-to-br from-[#0D1B2A] to-[#1E3148] px-4 py-[72px] sm:px-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-100"
          style={{
            background:
              "radial-gradient(ellipse at top right, rgba(200,146,42,0.10), transparent 50%), radial-gradient(ellipse at bottom left, rgba(200,146,42,0.06), transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative z-[1] mx-auto max-w-[1080px] text-center">
          <p className="mb-6 inline-flex items-center gap-3 text-[11.5px] font-bold uppercase tracking-[2px] text-[#E8B84B]">
            <span className="h-px w-8 bg-[#C8922A]/50" />
            {t("identityEyebrow")}
            <span className="h-px w-8 bg-[#C8922A]/50" />
          </p>
          <h2 className="heading mx-auto max-w-[900px] text-3xl font-bold leading-snug tracking-tight text-white sm:text-[40px]">
            {t("identityTitle1")}
            <br />
            <em className="not-italic text-[#E8B84B]">{t("identityTitle2")}</em>
          </h2>
          <p className="mx-auto mt-7 max-w-[820px] text-base leading-[1.75] text-white/[0.75]">{t("identityBody")}</p>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  href,
  title,
  description,
  cta,
  className = "",
}: {
  href: string;
  title: string;
  description: string;
  cta: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-[12px] border border-border bg-card p-7 shadow-[0_1px_3px_rgba(13,27,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(13,27,42,0.08)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.45)] ${className}`}
    >
      <span className="absolute left-0 right-0 top-0 h-[3px] origin-left scale-x-0 bg-[#C8922A] transition group-hover:scale-x-100" />
      <h3 className="heading text-[17px] font-bold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[#C8922A]">
        {cta}
        <span aria-hidden className="transition group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
