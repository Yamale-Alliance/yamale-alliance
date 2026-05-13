import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { BookOpen, Search, ChevronRight } from "lucide-react";
import { PROTOTYPE_HERO_GRID_PATTERN } from "@/components/layout/prototype-page-styles";

export default async function Home() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Hero (prototype: PAGE 1 — HOME) ─── */}
      <section className="relative flex min-h-[580px] items-center overflow-hidden bg-[#0D1B2A]">
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

        <div className="relative z-[1] mx-auto w-full max-w-[1280px] px-4 py-16 sm:px-8 sm:py-20">
          <h1 className="heading max-w-[680px] text-[2.75rem] font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl md:text-[56px] lg:text-[62px]">
            Law Without Barriers.
            <br />
            <em className="not-italic text-[#E8B84B]">Business Without Borders.</em>
          </h1>

          <div className="mt-7 inline-flex items-center gap-2.5 rounded-full border border-[rgba(200,146,42,0.22)] bg-[rgba(200,146,42,0.08)] px-3.5 py-2 text-[13px] font-semibold tracking-[0.02em] text-[#E8B84B]">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8B84B] shadow-[0_0_0_4px_rgba(200,146,42,0.2)]" />
            African-built. African-governed. Reinvesting in Africa&apos;s legal future.
          </div>

          <p className="mt-7 max-w-[520px] text-lg leading-relaxed text-white/[0.65]">
            The first unified platform for African legal research — covering all 54 countries, AfCFTA compliance, AI-powered queries, and a curated network of African legal professionals.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/library"
              className="inline-flex items-center gap-2 rounded-[6px] bg-[#C8922A] px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#b07e22]"
            >
              <BookOpen className="h-4 w-4" strokeWidth={2} />
              Browse Legal Library
            </Link>
            <Link
              href="/ai-research"
              className="inline-flex items-center gap-2 rounded-[6px] border-[1.5px] border-white/40 bg-transparent px-6 py-3 text-base font-semibold text-white transition hover:border-white hover:bg-white hover:text-[#0D1B2A]"
            >
              <Search className="h-4 w-4" strokeWidth={2} />
              Try AI Research
            </Link>
            {isSignedIn && (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-[6px] border border-white/25 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                Dashboard
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          <div className="mt-14 flex flex-wrap gap-x-10 gap-y-8 border-t border-white/10 pt-10 md:gap-x-14">
            <div>
              <div className="heading text-[28px] font-bold leading-none text-[#E8B84B] md:text-[32px]">54</div>
              <div className="mt-1 text-[13px] text-white/50">African countries covered</div>
            </div>
            <div>
              <div className="heading text-[28px] font-bold leading-none text-[#E8B84B] md:text-[32px]">3000+</div>
              <div className="mt-1 text-[13px] text-white/50">Laws &amp; regulations</div>
            </div>
            <div>
              <div className="heading text-[28px] font-bold leading-none text-[#E8B84B] md:text-[32px]">12</div>
              <div className="mt-1 text-[13px] text-white/50">Legal domains</div>
            </div>
            <div>
              <div className="heading text-[28px] font-bold leading-none text-[#E8B84B] md:text-[32px]">AfCFTA</div>
              <div className="mt-1 text-[13px] text-white/50">Passport tool — first of its kind</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <div className="border-b border-border bg-[#0D1B2A] px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-12 gap-y-4">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-white/40">Trusted by</span>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm font-semibold text-white/60">
            <span>Law firms</span>
            <span>Governments</span>
            <span>Mining companies</span>
            <span>AfCFTA operators</span>
            <span>Development institutions</span>
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="border-b border-border bg-background px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="mx-auto mb-12 max-w-[560px] text-center">
            <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.5px] text-[#C8922A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C8922A]" />
              Platform
            </p>
            <h2 className="heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything you need to navigate African law
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Five integrated tools — from raw legislation to expert connections — built for legal professionals, investors, and governments operating across the continent.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              href="/library"
              title="Legal Library"
              description="Every African country's business laws, free to read, in one place. Search all 54 jurisdictions by domain and status."
              cta="Browse the library"
            />
            <FeatureCard
              href="/afcfta/compliance-check"
              title="AfCFTA Passport"
              description="The AfCFTA compliance infrastructure your business — or your ministry — needs. The first step-by-step tool for cross-border trade."
              cta="Start your passport"
            />
            <FeatureCard
              href="/ai-research"
              title="AI Legal Research"
              description="Ask complex legal questions in natural language. Responses are drawn from African legal texts within the Yamalé Legal Library — not generic AI output."
              cta="Ask a question"
            />
            <FeatureCard
              href="/marketplace"
              title="The Yamalé Vault"
              description="Courses, webinars, documents, and templates in mining law, M&A, corporate law, and tax — specialized expertise, on demand."
              cta="Explore the Vault"
            />
            <FeatureCard
              href="/lawyers"
              title="Find a Lawyer"
              description="Find the right commercial lawyer in any African jurisdiction — fast. Curated, invitation-only directory."
              cta="Search directory"
              className="sm:col-span-2 lg:col-span-1"
            />
          </div>
        </div>
      </section>

      {/* Social enterprise strip */}
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
            Our identity
            <span className="h-px w-8 bg-[#C8922A]/50" />
          </p>
          <h2 className="heading mx-auto max-w-[900px] text-3xl font-bold leading-snug tracking-tight text-white sm:text-[40px]">
            African-built. African-governed.
            <br />
            <em className="not-italic text-[#E8B84B]">Reinvesting in Africa&apos;s legal future.</em>
          </h2>
          <p className="mx-auto mt-7 max-w-[820px] text-base leading-[1.75] text-white/[0.75]">
            Yamalé is two entities, one mission. A committed share of platform revenue flows annually from the for-profit platform to the{" "}
            <strong className="font-semibold text-[#E8B84B]">Yamalé Alliance</strong> nonprofit — funding{" "}
            <strong className="font-semibold text-[#E8B84B]">Government Representation in Complex Negotiations</strong>,{" "}
            <strong className="font-semibold text-[#E8B84B]">Community Rights Advocacy in Extractive Industries</strong>, and{" "}
            <strong className="font-semibold text-[#E8B84B]">Government Systems Strengthening</strong>. Every subscriber is, in a small way, building Africa&apos;s legal infrastructure.
          </p>
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
