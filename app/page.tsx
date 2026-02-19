import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { BookOpen, FileCheck, Search, Scale, ShoppingBag, ArrowRight, CheckCircle2 } from "lucide-react";
import { PlatformLogo } from "@/components/platform/PlatformLogo";
export default async function Home() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div className="min-h-screen">
      {/* Hero — maximal gradient orbs, spotlight, premium badge & type */}
      <section className="relative overflow-hidden border-b border-border/30">
        <div
          className="absolute -top-40 left-1/2 h-[480px] w-[800px] -translate-x-1/2 rounded-full opacity-[0.18] blur-[100px] dark:opacity-25"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
        />
        <div
          className="absolute right-0 top-1/2 h-72 w-72 -translate-y-1/2 translate-x-1/4 rounded-full opacity-[0.12] blur-[80px] dark:opacity-18"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full opacity-[0.1] blur-[70px] dark:opacity-15"
          style={{ background: "radial-gradient(circle, var(--muted) 0%, transparent 70%)" }}
        />
        <div
          className="absolute inset-0 -z-10 opacity-[0.5] dark:opacity-[0.35]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
          }}
        />
        <div
          className="absolute inset-0 -z-20 opacity-30 dark:opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c18c43' fill-opacity='0.12' fill-rule='evenodd'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative mx-auto max-w-5xl px-4 py-6 text-center sm:py-8 md:py-10">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-[2.85rem] lg:leading-[1.12] lg:tracking-tighter">
            African law,{" "}
            <span className="bg-gradient-to-r from-primary via-amber-600 to-amber-500 bg-clip-text text-transparent dark:via-amber-400">
              accessible and verifiable
            </span>
          </h1>
          <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <p className="mx-auto mt-4 max-w-2xl text-base leading-snug text-muted-foreground sm:mt-5 sm:text-lg">
            Your trusted source for national and regional law, AfCFTA tools, and
            AI-powered research—grounded in verified sources.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:mt-7 sm:gap-4">
            {isSignedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="group relative inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-[1.04] hover:shadow-2xl hover:shadow-primary/40 sm:text-base"
                >
                  Open dashboard
                  <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/ai-research"
                  className="group inline-flex items-center gap-2 rounded-2xl border-2 border-primary/60 bg-background/90 px-7 py-3.5 text-sm font-bold backdrop-blur-sm transition-all duration-300 hover:scale-[1.04] hover:border-primary hover:bg-primary/10 sm:text-base"
                >
                  AI Legal Research
                  <ArrowRight className="h-5 w-5 opacity-70 transition group-hover:translate-x-1 group-hover:opacity-100" />
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-[1.04] hover:shadow-2xl hover:shadow-primary/40 sm:text-base"
                >
                  Get started free
                  <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2 rounded-2xl border-2 border-primary/60 bg-background/90 px-7 py-3.5 text-sm font-bold backdrop-blur-sm transition-all duration-300 hover:scale-[1.04] hover:border-primary hover:bg-primary/10 sm:text-base"
                >
                  Sign in
                  <ArrowRight className="h-5 w-5 opacity-70 transition group-hover:translate-x-1 group-hover:opacity-100" />
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Trust strip — pill bar with gradient */}
        <div className="relative border-t border-border/40 bg-gradient-to-r from-primary/5 via-background/80 to-primary/5 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-4 text-xs font-semibold text-muted-foreground sm:gap-x-10 sm:py-5 sm:text-sm">
            <span className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Legal Library
            </span>
            <span className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              AfCFTA Tools
            </span>
            <span className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              AI Research
            </span>
            <span className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Verified sources
            </span>
          </div>
        </div>
      </section>

      {/* Features — gradient borders, shine, stronger cards */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-muted/30 via-muted/10 to-background">
        <div className="absolute inset-0 -z-10 opacity-40 dark:opacity-25" style={{ backgroundImage: `radial-gradient(ellipse 60% 50% at 50% 0%, var(--primary) 0%, transparent 50%)` }} />
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24 md:py-28">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary sm:text-sm">What we offer</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Everything you need in one place
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
              One platform for legal reference, compliance, and research across Africa.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-6 lg:gap-6">
            {/* Featured: Legal Library */}
            <Link
              href="/library"
              className="group relative overflow-hidden rounded-[1.75rem] border-2 border-primary/40 bg-gradient-to-br from-primary/20 via-card to-primary/10 p-8 shadow-xl transition-all duration-300 hover:-translate-y-2 hover:border-primary/60 hover:shadow-2xl hover:shadow-primary/20 lg:col-span-2 shine-hover"
            >
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/25 blur-3xl transition group-hover:bg-primary/35" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/25 text-primary shadow-inner ring-2 ring-primary/20 transition group-hover:bg-primary/35 group-hover:ring-primary/40">
                <BookOpen className="h-8 w-8" />
              </div>
              <h3 className="relative mt-6 text-xl font-extrabold text-foreground">Legal Library</h3>
              <p className="relative mt-3 text-sm leading-relaxed text-muted-foreground">
                Browse African legal materials by jurisdiction and domain. Find what you need, fast.
              </p>
              <span className="relative mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary">
                Explore library
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>

            <Link
              href="/afcfta"
              className="group relative overflow-hidden rounded-[1.75rem] border-2 border-border/80 bg-card p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/15 lg:col-span-2 shine-hover"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary ring-2 ring-primary/10 transition group-hover:ring-primary/30">
                <FileCheck className="h-8 w-8" />
              </div>
              <h3 className="mt-5 font-extrabold text-foreground">AfCFTA Compliance</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Step-by-step tools for cross-border trade and investment.
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-primary">
                Get started
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>

            <Link
              href="/ai-research"
              className="group relative overflow-hidden rounded-[1.75rem] border-2 border-border/80 bg-card p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/15 lg:col-span-2 shine-hover"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary ring-2 ring-primary/10 transition group-hover:ring-primary/30">
                <Search className="h-8 w-8" />
              </div>
              <h3 className="mt-5 font-extrabold text-foreground">AI Legal Research</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Natural-language queries with citations to verified sources.
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-primary">
                Try it
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>

            <Link
              href="/marketplace"
              className="group relative overflow-hidden rounded-[1.75rem] border-2 border-border/80 bg-card p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/15 lg:col-span-3 shine-hover"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary ring-2 ring-primary/10 transition group-hover:ring-primary/30">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <h3 className="mt-5 font-extrabold text-foreground">Marketplace</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Books, courses, and templates for legal and compliance.
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-primary">
                Browse
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>

            <Link
              href="/lawyers"
              className="group relative overflow-hidden rounded-[1.75rem] border-2 border-border/80 bg-card p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/15 lg:col-span-3 shine-hover"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary ring-2 ring-primary/10 transition group-hover:ring-primary/30">
                <Scale className="h-8 w-8" />
              </div>
              <h3 className="mt-5 font-extrabold text-foreground">Find a Lawyer</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect with verified legal professionals when you need advice.
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-primary">
                Find
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA — gradient border, multiple glows */}
      <section className="relative overflow-hidden py-20 sm:py-24">
        <div className="absolute inset-0 -z-20 opacity-[0.12] dark:opacity-[0.18]" style={{ backgroundImage: `radial-gradient(ellipse 90% 70% at 50% 100%, var(--primary) 0%, transparent 55%)` }} />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.06] blur-[120px] dark:opacity-10" style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }} />
        <div className="mx-auto max-w-4xl px-4">
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-primary/50 bg-card/95 p-10 shadow-2xl shadow-primary/20 backdrop-blur-md sm:p-14 dark:shadow-primary/15 gradient-border">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" aria-hidden />
            <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/15 blur-2xl" aria-hidden />
            <div className="relative text-center">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                Ready to get started?
              </h2>
              <p className="mx-auto mt-6 max-w-lg text-lg text-muted-foreground">
                Create an account to access the legal library, AfCFTA tools, and
                AI-powered research.
              </p>
              <ul className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  No credit card required
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  Free to start
                </li>
              </ul>
              <div className="mt-10">
                {isSignedIn ? (
                  <Link
                    href="/dashboard"
                    className="group inline-flex items-center gap-2 rounded-2xl bg-primary px-10 py-4 text-base font-bold text-primary-foreground shadow-xl shadow-primary/35 transition-all duration-300 hover:scale-[1.05] hover:shadow-2xl hover:shadow-primary/40"
                  >
                    Open dashboard
                    <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                  </Link>
                ) : (
                  <Link
                    href="/signup"
                    className="group inline-flex items-center gap-2 rounded-2xl bg-primary px-10 py-4 text-base font-bold text-primary-foreground shadow-xl shadow-primary/35 transition-all duration-300 hover:scale-[1.05] hover:shadow-2xl hover:shadow-primary/40"
                  >
                    Sign up free
                    <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}