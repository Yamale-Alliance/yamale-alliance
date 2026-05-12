import type { ReactNode } from "react";
import Link from "next/link";
import { PlatformLogo } from "@/components/platform/PlatformLogo";
import { ArrowUpRight, Mail } from "lucide-react";

const productLinks = [
  { href: "/library", label: "Legal Library" },
  { href: "/afcfta/compliance-check", label: "AfCFTA Tools" },
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

/** Yamalé prototype footer — navy block + muted links (yamale_prototype.html). */
export function Footer() {
  return (
    <footer className="mt-auto print:hidden" role="contentinfo">
      <div className="bg-[#0D1B2A] px-4 pb-12 pt-14 text-white sm:px-8">
        <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
          <div className="max-w-md">
            <Link href="/" className="inline-block opacity-95 transition hover:opacity-100" aria-label="Yamalé home">
              <PlatformLogo height={64} width={220} className="h-14 w-auto max-w-[220px]" />
            </Link>
            <p className="heading mt-6 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem] sm:leading-snug">
              African law, accessible to those who shape the continent&apos;s future.
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-white/45">
              National and regional law, AfCFTA compliance, and AI-powered legal research—in one place.
            </p>
          </div>
          <LinkGroup title="Product" links={productLinks} />
          <LinkGroup title="Company" links={companyLinks} />
          <LinkGroup title="Legal" links={legalLinks} />
        </div>

        <div className="mx-auto mt-10 max-w-[920px] border-t border-white/[0.08] pt-8 text-[12px] leading-[1.7] text-white/40">
          <p>
            <strong className="font-semibold text-white/[0.65]">Important:</strong> Yamalé Legal Platform provides legal information for reference purposes only. Content is not legal advice and does not create an attorney-client relationship. Laws change frequently — always verify current status with official sources or{" "}
            <Link href="/lawyers" className="text-[#E8B84B] underline underline-offset-2 hover:text-[#E8B84B]/90">
              qualified legal counsel
            </Link>{" "}
            before making decisions.
          </p>
          <p className="mt-3">
            By using this platform, you agree to our <FooterLink href="/terms">Terms</FooterLink> and{" "}
            <FooterLink href="/privacy">Privacy Policy</FooterLink>. We collect usage data to improve the platform. We do not sell personal data to third parties.
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#0D1B2A] px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-6 sm:flex-row sm:justify-between sm:gap-4">
          <a
            href="mailto:it@yamalealliance.org"
            className="group inline-flex items-center gap-2 rounded-[6px] border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:border-primary/50 hover:bg-white/10"
          >
            <Mail className="h-4 w-4 text-primary" />
            <span>it@yamalealliance.org</span>
            <ArrowUpRight className="h-4 w-4 text-primary opacity-80 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
          <p className="text-center text-xs text-white/45 sm:text-left">
            © {new Date().getFullYear()} Yamalé Alliance · Dakar, Senegal
          </p>
        </div>
      </div>
    </footer>
  );
}
