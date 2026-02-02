import Link from "next/link";
import { BookOpen, FileCheck, Search, Scale } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:py-28">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          African law,{" "}
          <span className="text-primary">accessible and verifiable</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Yamalé Legal Platform is your trusted source for African national and
          regional law, AfCFTA compliance tools, and AI-powered legal research
          grounded in verified sources.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium hover:bg-accent"
          >
            Sign in
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Pricing
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            What Yamalé offers
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            One platform for legal reference, compliance, and research across
            Africa.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/library"
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:bg-accent/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Legal Library</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Browse African legal materials by jurisdiction and domain.
              </p>
            </Link>
            <Link
              href="/afcfta"
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:bg-accent/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileCheck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">AfCFTA Compliance</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Step-by-step tools for cross-border trade and investment.
              </p>
            </Link>
            <Link
              href="/ai-research"
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:bg-accent/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">AI Legal Research</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Natural-language queries with citations to verified sources.
              </p>
            </Link>
            <Link
              href="/lawyers"
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:bg-accent/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Scale className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Find a Lawyer</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect with verified legal professionals when you need advice.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="rounded-2xl border border-border bg-card p-8 text-center sm:p-12">
          <h2 className="text-xl font-semibold sm:text-2xl">
            Ready to get started?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Create an account to access the legal library, AfCFTA tools, and
            AI-powered research.
          </p>
          <div className="mt-6">
            <Link
              href="/signup"
              className="inline-flex rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-6 px-4 text-sm text-muted-foreground">
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/library" className="hover:text-foreground">
            Library
          </Link>
          <Link href="/afcfta" className="hover:text-foreground">
            AfCFTA
          </Link>
          <Link href="/ai-research" className="hover:text-foreground">
            AI Research
          </Link>
          <span>© Yamalé Legal Platform</span>
        </div>
      </footer>
    </div>
  );
}
