import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Yamalé Legal Platform",
  description:
    "Terms of Service for Yamalé Legal Platform – rules and conditions for using our services.",
};

// Match brand tokens used in pricing / privacy / lawyers / marketplace
const BRAND = {
  dark: "#221913",
  medium: "#603b1c",
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
  accent: "#e3ba65",
};

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <h2 className="mt-10 mb-3 text-2xl font-bold" style={{ color: BRAND.dark }}>
      {number}. {title}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[15px] leading-relaxed text-foreground/90">{children}</p>;
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mb-4 space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className="list-disc text-[15px] leading-relaxed text-foreground/90 marker:text-[#c18c43]"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="my-5 rounded-lg border-l-4 px-5 py-4"
      style={{ borderColor: BRAND.gradientEnd, backgroundColor: "rgba(227,186,101,0.08)" }}
    >
      <span
        className="mb-1 block text-sm font-bold uppercase tracking-wide"
        style={{ color: BRAND.medium }}
      >
        {label}
      </span>
      <div className="text-[15px] leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Hero banner */}
      <div
        className="py-16 text-white"
        style={{ background: `linear-gradient(135deg, ${BRAND.dark} 0%, ${BRAND.medium} 100%)` }}
      >
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Terms of Service</h1>
          <p className="mt-3 text-lg opacity-90">
            Rules and conditions for using the Yamalé Legal Platform
          </p>
          <p className="mt-2 text-sm" style={{ color: BRAND.accent }}>
            Last updated: February 12, 2026
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-xl bg-white dark:bg-card shadow-md border border-border p-8 sm:p-10">
          <SectionHeading number="1" title="Acceptance of Terms" />
          <P>
            By accessing or using Yamalé Legal Platform (&ldquo;Platform&rdquo;, &ldquo;we&rdquo;,
            &ldquo;us&rdquo;, &ldquo;our&rdquo;), including our website, legal library, AfCFTA
            tools, AI legal research, lawyer directory, The Yamale Vault, and any related services, you
            agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree,
            you must not use the Platform. Additional terms may apply to specific features (for
            example, payments or lawyer verification); those terms are incorporated by reference.
          </P>

          <SectionHeading number="2" title="Description of Services" />
          <P>Yamalé Legal Platform provides, among other things:</P>
          <BulletList
            items={[
              <>
                <strong>Legal Library:</strong> Browse and access African legal materials by
                jurisdiction and domain.
              </>,
              <>
                <strong>AfCFTA Tools:</strong> Cross-border compliance tools, sector checklists, and
                rules-of-origin style guidance.
              </>,
              <>
                <strong>AI Legal Research:</strong> AI-powered research assistance for African law
                and compliance. Responses are indicative and do not constitute legal advice.
              </>,
              <>
                <strong>Lawyer Directory:</strong> Directory of verified legal professionals. Contact
                details may be unlocked by payment (per-search or day pass) as described on the
                Platform.
              </>,
              <>
                <strong>The Yamale Vault:</strong> Digital products (for example, books, courses,
                templates) for legal and compliance use. Claims and access are subject to payment
                and any item-specific terms.
              </>,
              <>
                <strong>Subscriptions and Payments:</strong> Subscription plans (for example, Basic,
                Pro, Team) and one-off purchases (for example, search unlocks, day pass, The Yamale
                Vault items) as described on the pricing and checkout pages.
              </>,
            ]}
          />

          <SectionHeading number="3" title="Accounts and Eligibility" />
          <P>
            You must be at least 18 years old and able to form a binding contract to use the
            Platform. You are responsible for keeping your account credentials secure and for all
            activity under your account. You must provide accurate and complete information when
            registering. Lawyers must complete verification and profile requirements; we may
            approve, reject, or remove listings at our discretion.
          </P>

          <SectionHeading number="4" title="Subscriptions and Payments" />
          <P>
            Subscription fees, one-off payments (for example, lawyer contact unlocks, day pass,
            The Yamale Vault purchases), and billing cycles are as displayed at the time of purchase.
            Payments are processed by our payment providers (such as pawaPay). By purchasing, you
            agree to the applicable pricing and any refund policy stated on the Platform. We may
            change fees with notice where required; continued use after changes may constitute
            acceptance. Subscription and usage limits (for example, AI research credits) are
            enforced as described in the product and in our Privacy Policy.
          </P>

          <SectionHeading number="5" title="Lawyer Directory and Unlocks" />
          <P>
            The lawyer directory is for informational and contact purposes. Listing does not
            guarantee availability or suitability. Unlocking contact details (per-search or via day
            pass) grants you access to the details displayed at the time of unlock. We do not
            guarantee outcomes of any engagement with lawyers. Any agreement between you and a
            lawyer is solely between you and that lawyer; we are not a party to such agreements.
          </P>

          <SectionHeading number="6" title="AI Research – Not Legal Advice" />
          <Callout label="Important">
            AI legal research on the Platform is for general information and research only. It does
            <strong> not</strong> constitute legal, tax, or professional advice. Responses may be
            incomplete, outdated, or not applicable to your situation. You must not rely on AI
            output as a substitute for advice from a qualified lawyer or other professional. We
            strongly recommend consulting a qualified professional for any specific legal or
            compliance matter.
          </Callout>

          <SectionHeading number="7" title="Acceptable Use" />
          <P>You agree not to:</P>
          <BulletList
            items={[
              "Use the Platform in violation of any applicable law or regulation.",
              "Infringe the intellectual property or other rights of us or any third party.",
              "Transmit malware, spam, or harmful or illegal content.",
              "Attempt to gain unauthorised access to our systems, other accounts, or third-party services.",
              "Scrape, automate access to, or overload the Platform in a way that impairs its operation.",
              "Use the Platform to harass, defame, or harm others.",
            ]}
          />
          <P>
            We may suspend or terminate access for breach of these Terms or for any other reason we
            consider necessary to protect the Platform, our users, or third parties.
          </P>

          <SectionHeading number="8" title="Intellectual Property" />
          <P>
            The Platform (including design, text, software, and our branding) is owned or licensed
            by us. You may not copy, modify, distribute, or create derivative works without our
            prior written consent. Legal and Yamale Vault content may be subject to third-party
            rights; your use must comply with any licences or terms shown for that content.
          </P>

          <SectionHeading number="9" title="Disclaimers" />
          <Callout label="Disclaimer">
            THE PLATFORM AND ALL CONTENT AND SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
            AVAILABLE&rdquo;. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
            WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL
            COMPONENTS. USE OF AI RESEARCH, THE LEGAL LIBRARY, AFCFTA TOOLS, AND LAWYER LISTINGS IS
            AT YOUR OWN RISK.
          </Callout>

          <SectionHeading number="10" title="Limitation of Liability" />
          <P>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE (AND OUR AFFILIATES, OFFICERS,
            EMPLOYEES, AND AGENTS) SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, DATA, OR GOODWILL, ARISING
            FROM YOUR USE OF OR INABILITY TO USE THE PLATFORM. OUR TOTAL LIABILITY FOR ANY CLAIMS
            ARISING OUT OF OR RELATED TO THESE TERMS OR THE PLATFORM SHALL NOT EXCEED THE AMOUNT YOU
            PAID US IN THE TWELVE (12) MONTHS BEFORE THE CLAIM (OR, IF GREATER, ONE HUNDRED US
            DOLLARS). SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS; IN SUCH CASES OUR
            LIABILITY WILL BE LIMITED TO THE MAXIMUM EXTENT PERMITTED BY LAW.
          </P>

          <SectionHeading number="11" title="Indemnity" />
          <P>
            You agree to indemnify and hold harmless Yamalé Legal Platform and its affiliates,
            officers, employees, and agents from any claims, damages, losses, or expenses (including
            reasonable legal fees) arising from your use of the Platform, your breach of these
            Terms, or your violation of any law or third-party rights.
          </P>

          <SectionHeading number="12" title="Termination" />
          <P>
            We may suspend or terminate your access to the Platform at any time, with or without
            cause or notice. You may stop using the Platform at any time. On termination, your right
            to use the Platform ceases; provisions that by their nature should survive (for example,
            disclaimers, limitation of liability, indemnity, governing law) will survive.
          </P>

          <SectionHeading number="13" title="Governing Law and Disputes" />
          <P>
            These Terms are governed by the laws of the jurisdiction in which Yamalé Legal Platform
            operates, without regard to conflict-of-law principles. Any dispute arising out of or
            relating to these Terms or the Platform shall be resolved in the courts of that
            jurisdiction, except where prohibited. You may also have rights under consumer
            protection laws in your country that cannot be waived by contract.
          </P>

          <SectionHeading number="14" title="Changes to the Terms" />
          <P>
            We may modify these Terms from time to time. We will post the updated Terms on this page
            and update the &ldquo;Last updated&rdquo; date. Your continued use of the Platform after
            changes constitutes acceptance. For material changes, we may provide additional notice
            (for example, by email or in-product notice) where required by law.
          </P>

          <SectionHeading number="15" title="Contact" />
          <P>
            For questions about these Terms, contact us at{" "}
            <a
              href="mailto:it@yamalealliance.org"
              className="font-medium underline"
              style={{ color: BRAND.gradientEnd }}
            >
              it@yamalealliance.org
            </a>
            .
          </P>

          <div
            className="mt-8 rounded-lg px-5 py-4 text-center text-sm"
            style={{ backgroundColor: "rgba(227,186,101,0.1)", color: BRAND.medium }}
          >
            These Terms of Service were last updated on{" "}
            <strong>February 12, 2026</strong>. Please review them periodically for updates.
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          <Link
            href="/privacy"
            className="font-medium hover:underline"
            style={{ color: BRAND.gradientEnd }}
          >
            Privacy Policy
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/" className="font-medium hover:underline" style={{ color: BRAND.gradientEnd }}>
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
