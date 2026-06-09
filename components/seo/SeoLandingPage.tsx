import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import type { SeoLandingPageContent } from "@/lib/seo-ai-research-content";
import {
  prototypeHeroEyebrowClass,
  prototypeNavyHeroSectionClass,
  PROTOTYPE_HERO_GRID_PATTERN,
} from "@/components/layout/prototype-page-styles";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";

type Props = {
  content: SeoLandingPageContent;
};

export function SeoLandingPage({ content }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <FaqJsonLd faqs={content.faqs} />

      <section className={prototypeNavyHeroSectionClass}>
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundImage: PROTOTYPE_HERO_GRID_PATTERN }}
          aria-hidden
        />
        <div className="relative z-[1] mx-auto max-w-3xl px-4 py-12 sm:px-8 sm:py-16">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Yamalé Legal Platform
          </Link>
          <p className={`mt-8 ${prototypeHeroEyebrowClass}`}>{content.eyebrow}</p>
          <h1 className="heading mt-5 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
            {content.h1}
          </h1>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/ai-research"
              className="inline-flex items-center gap-2 rounded-[6px] bg-[#C8922A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b07e22]"
            >
              <Search className="h-4 w-4" />
              Try AI Research
            </Link>
            <Link
              href="/library"
              className="inline-flex items-center gap-2 rounded-[6px] border border-white/35 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10"
            >
              Browse the library
            </Link>
          </div>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-8 sm:py-14">
        <div className="prose prose-neutral max-w-none dark:prose-invert">
          {content.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="text-base leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>

        <h2 className="heading mt-12 text-2xl font-semibold tracking-tight text-foreground">
          Why teams use Yamalé
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {content.features.map((feature) => (
            <li
              key={feature.title}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </li>
          ))}
        </ul>

        <h2 className="heading mt-12 text-2xl font-semibold tracking-tight text-foreground">
          Frequently asked questions
        </h2>
        <dl className="mt-6 space-y-6">
          {content.faqs.map((faq) => (
            <div key={faq.question} className="border-b border-border pb-6 last:border-0">
              <dt className="text-base font-semibold text-foreground">{faq.question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
            </div>
          ))}
        </dl>

        {content.relatedLinks.length > 0 ? (
          <nav className="mt-12 rounded-xl border border-border bg-muted/30 p-6" aria-label="Related pages">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Related
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {content.relatedLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-[#8a6518] underline-offset-2 hover:underline dark:text-[#e3ba65]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center rounded-[6px] bg-[#0D1B2A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#162436]"
          >
            View pricing
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center rounded-[6px] border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            Contact us
          </Link>
        </div>
      </article>
    </div>
  );
}
