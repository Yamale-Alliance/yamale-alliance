"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { getAiResearchGuidesContent } from "@/lib/i18n/ai-research-guides";

type Props = {
  /** When true, omit the top h1 (caller renders a hero instead). */
  hideTitle?: boolean;
};

export function AiResearchMarketingContent({ hideTitle = false }: Props) {
  const locale = useLocale();
  const { eyebrow, h1, intro, features, faqs, relatedLinks, whatYouGet, faqTitle, exploreGuides, exploreGuidesAria } =
    getAiResearchGuidesContent(locale);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C8922A]">{eyebrow}</p>
      {!hideTitle ? (
        <h1
          id="ai-research-seo-heading"
          className="heading mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          {h1}
        </h1>
      ) : null}

      <div className={hideTitle ? "mt-4 space-y-4" : "mt-6 space-y-4"}>
        {intro.map((paragraph) => (
          <p key={paragraph.slice(0, 40)} className="text-base leading-relaxed text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </div>

      <h2 className="heading mt-10 text-xl font-semibold text-foreground">{whatYouGet}</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {features.map((feature) => (
          <li
            key={feature.title}
            className="rounded-lg border border-border bg-card p-4 text-sm"
          >
            <strong className="text-foreground">{feature.title}.</strong>{" "}
            <span className="text-muted-foreground">{feature.body}</span>
          </li>
        ))}
      </ul>

      <h2 className="heading mt-10 text-xl font-semibold text-foreground">{faqTitle}</h2>
      <dl className="mt-4 space-y-5">
        {faqs.map((faq) => (
          <div key={faq.question}>
            <dt className="font-semibold text-foreground">{faq.question}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
          </div>
        ))}
      </dl>

      <nav className="mt-10" aria-label={exploreGuidesAria}>
        <p className="text-sm font-semibold text-foreground">{exploreGuides}</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {relatedLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="font-medium text-[#8a6518] underline-offset-2 hover:underline dark:text-[#e3ba65]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
