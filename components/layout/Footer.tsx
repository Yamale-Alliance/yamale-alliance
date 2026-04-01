import Link from "next/link";
import { PlatformLogo } from "@/components/platform/PlatformLogo";
import { ArrowUpRight, Mail } from "lucide-react";

const productLinks = [
  { href: "/library", label: "Legal Library" },
  { href: "/afcfta", label: "AfCFTA Tools" },
  { href: "/ai-research", label: "AI Research" },
  { href: "/marketplace", label: "The Yamale Vault" },
  { href: "/lawyers", label: "Find a Lawyer" },
];

const companyLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/signup", label: "Sign up" },
  { href: "/login", label: "Sign in" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block rounded-lg px-2 py-1 text-sm text-muted-foreground transition hover:bg-primary/15 hover:text-foreground"
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/90 mb-3">
        {title}
      </p>
      <ul className="flex flex-col gap-y-1.5">
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
  return (
    <footer
      className="mt-auto relative overflow-hidden"
      role="contentinfo"
    >
      {/* Gradient / brand block */}
      <div className="relative border-t border-border/50 bg-gradient-to-b from-muted/20 via-background to-background dark:from-muted/10 dark:via-background dark:to-background">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px),
                              linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            {/* Brand + statement */}
            <div className="max-w-xl">
              <Link
                href="/"
                className="inline-block transition opacity-90 hover:opacity-100"
                aria-label="Yamalé home"
              >
                <PlatformLogo height={64} width={220} className="h-16 w-auto" />
              </Link>
              <p className="heading mt-6 text-2xl font-medium tracking-tight text-foreground sm:text-3xl lg:text-[2rem] lg:leading-tight">
                African law, accessible and verifiable.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                National and regional law, AfCFTA compliance, and AI-powered legal research—in one place.
              </p>
            </div>
            {/* Link groups */}
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-10">
              <LinkGroup title="Product" links={productLinks} />
              <LinkGroup title="Company" links={companyLinks} />
              <LinkGroup title="Legal" links={legalLinks} />
            </div>
          </div>
        </div>
      </div>

      {/* CTA + bottom bar */}
      <div className="border-t border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between sm:gap-4">
            <a
              href="mailto:it@yamalealliance.org"
              className="group flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/60 hover:bg-primary/20 hover:shadow-md hover:shadow-primary/10"
            >
              <Mail className="h-4 w-4 text-primary" />
              <span>it@yamalealliance.org</span>
              <ArrowUpRight className="h-4 w-4 text-primary opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Yamalé Legal Platform
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
