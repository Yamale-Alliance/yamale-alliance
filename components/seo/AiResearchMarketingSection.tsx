import Link from "next/link";
import { AI_RESEARCH_MAIN_SEO } from "@/lib/seo-ai-research-content";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";

/**
 * Server-rendered SEO body for /ai-research.
 * Sits below the client chat shell so crawlers always receive substantive HTML.
 */
export function AiResearchMarketingSection() {
  const { eyebrow, h1, intro, features, faqs, relatedLinks } = AI_RESEARCH_MAIN_SEO;

  return (
    <section
      id="about-ai-legal-research"
      className="border-t border-border bg-[#fafaf7] px-4 py-14 dark:bg-[#0a1420] sm:px-8"
      aria-labelledby="ai-research-seo-heading"
    >
      <FaqJsonLd faqs={faqs} />
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C8922A]">{eyebrow}</p>
        <h1
          id="ai-research-seo-heading"
          className="heading mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          {h1}
        </h1>

        <div className="mt-6 space-y-4">
          {intro.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="text-base leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>

        <h2 className="heading mt-10 text-xl font-semibold text-foreground">What you get</h2>
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

        <h2 className="heading mt-10 text-xl font-semibold text-foreground">Frequently asked questions</h2>
        <dl className="mt-4 space-y-5">
          {faqs.map((faq) => (
            <div key={faq.question}>
              <dt className="font-semibold text-foreground">{faq.question}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
            </div>
          ))}
        </dl>

        <nav className="mt-10" aria-label="AI research guides">
          <p className="text-sm font-semibold text-foreground">Explore guides</p>
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
    </section>
  );
}
