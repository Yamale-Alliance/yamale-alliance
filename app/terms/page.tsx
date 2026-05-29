import type { Metadata } from "next";
import {
  PolicyBulletList,
  PolicyCallout,
  PolicyFooterNav,
  PolicyHero,
  PolicyInlineLink,
  PolicyMailLink,
  PolicyP,
  PolicySectionHeading,
  PolicyUpdatedBanner,
} from "@/components/legal/policy-document-primitives";

export const metadata: Metadata = {
  title: "Terms of Service | Yamalé Legal Platform",
  description:
    "Terms of Service for Yamalé Legal Platform – rules and conditions for using our services.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <PolicyHero
        title="Terms of Service"
        subtitle="Rules and conditions for using the Yamalé Legal Platform"
        dateLine="Last updated: February 12, 2026"
      />

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-xl border border-border bg-white p-8 shadow-md dark:bg-card sm:p-10">
          <PolicySectionHeading number="1" title="Acceptance of Terms" />
          <PolicyP>
            By accessing or using Yamalé Legal Platform (&ldquo;Platform&rdquo;, &ldquo;we&rdquo;,
            &ldquo;us&rdquo;, &ldquo;our&rdquo;), including our website, legal library, AfCFTA
            tools, AI legal research, lawyer directory, The Yamale Vault, and any related services, you
            agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree,
            you must not use the Platform. Additional terms may apply to specific features (for
            example, payments or lawyer verification); those terms are incorporated by reference.
          </PolicyP>

          <PolicySectionHeading number="2" title="Description of Services" />
          <PolicyP>Yamalé Legal Platform provides, among other things:</PolicyP>
          <PolicyBulletList
            items={[
              <>
                <strong className="text-[#603b1c] dark:text-[#e3ba65]">Legal Library:</strong> Browse and access
                African legal materials by jurisdiction and domain.
              </>,
              <>
                <strong className="text-[#603b1c] dark:text-[#e3ba65]">AfCFTA Tools:</strong> Cross-border
                compliance tools, sector checklists, and rules-of-origin style guidance.
              </>,
              <>
                <strong className="text-[#603b1c] dark:text-[#e3ba65]">AI Legal Research:</strong> AI-powered
                research assistance for African law and compliance. Responses are indicative and do not
                constitute legal advice.
              </>,
              <>
                <strong className="text-[#603b1c] dark:text-[#e3ba65]">Lawyer Directory:</strong> Directory of
                verified legal professionals. Contact details may be unlocked by payment (per-search or day
                pass) as described on the Platform.
              </>,
              <>
                <strong className="text-[#603b1c] dark:text-[#e3ba65]">The Yamale Vault:</strong> Digital products
                (for example, books, courses, templates) for legal and compliance use. Claims and access are
                subject to payment and any item-specific terms.
              </>,
              <>
                <strong className="text-[#603b1c] dark:text-[#e3ba65]">Subscriptions and Payments:</strong>{" "}
                Subscription plans (for example, Basic, Pro, Team) and one-off purchases (for example, search
                unlocks, day pass, The Yamale Vault items) as described on the pricing and checkout pages.
              </>,
            ]}
          />

          <PolicySectionHeading number="3" title="Accounts and Eligibility" />
          <PolicyP>
            You must be at least 18 years old and able to form a binding contract to use the
            Platform. You are responsible for keeping your account credentials secure and for all
            activity under your account. You must provide accurate and complete information when
            registering. Lawyers must complete verification and profile requirements; we may
            approve, reject, or remove listings at our discretion.
          </PolicyP>

          <PolicySectionHeading number="4" title="Subscriptions and Payments" />
          <PolicyP>
            Subscription fees, one-off payments (for example, lawyer contact unlocks, day pass,
            The Yamale Vault purchases), and billing cycles are as displayed at the time of purchase.
            Payments are processed by our payment providers (such as pawaPay). By purchasing, you
            agree to the applicable pricing and our{" "}
            <PolicyInlineLink href="/payment-refund">Payment &amp; Refund Policy</PolicyInlineLink>. We may
            change fees with notice where required; continued use after changes may constitute
            acceptance. Subscription and usage limits (for example, AI research credits) are
            enforced as described in the product and in our Privacy Policy.
          </PolicyP>

          <PolicySectionHeading number="5" title="Lawyer Directory and Unlocks" />
          <PolicyP>
            The lawyer directory is for informational and contact purposes. Listing does not
            guarantee availability or suitability. Unlocking contact details (per-search or via day
            pass) grants you access to the details displayed at the time of unlock. We do not
            guarantee outcomes of any engagement with lawyers. Any agreement between you and a
            lawyer is solely between you and that lawyer; we are not a party to such agreements.
          </PolicyP>

          <PolicySectionHeading number="6" title="AI Research – Not Legal Advice" />
          <PolicyCallout label="Important">
            AI legal research on the Platform is for general information and research only. It does
            <strong> not</strong> constitute legal, tax, or professional advice. Responses may be
            incomplete, outdated, or not applicable to your situation. You must not rely on AI
            output as a substitute for advice from a qualified lawyer or other professional. We
            strongly recommend consulting a qualified professional for any specific legal or
            compliance matter.
          </PolicyCallout>

          <PolicySectionHeading number="7" title="Acceptable Use" />
          <PolicyP>You agree not to:</PolicyP>
          <PolicyBulletList
            items={[
              "Use the Platform in violation of any applicable law or regulation.",
              "Infringe the intellectual property or other rights of us or any third party.",
              "Transmit malware, spam, or harmful or illegal content.",
              "Attempt to gain unauthorised access to our systems, other accounts, or third-party services.",
              "Scrape, automate access to, or overload the Platform in a way that impairs its operation.",
              "Use the Platform to harass, defame, or harm others.",
            ]}
          />
          <PolicyP>
            We may suspend or terminate access for breach of these Terms or for any other reason we
            consider necessary to protect the Platform, our users, or third parties.
          </PolicyP>

          <PolicySectionHeading number="8" title="Intellectual Property" />
          <PolicyP>
            The Platform (including design, text, software, and our branding) is owned or licensed
            by us. You may not copy, modify, distribute, or create derivative works without our
            prior written consent. Legal and Yamale Vault content may be subject to third-party
            rights; your use must comply with any licences or terms shown for that content.
          </PolicyP>

          <PolicySectionHeading number="9" title="Disclaimers" />
          <PolicyCallout label="Disclaimer">
            THE PLATFORM AND ALL CONTENT AND SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
            AVAILABLE&rdquo;. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
            WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL
            COMPONENTS. USE OF AI RESEARCH, THE LEGAL LIBRARY, AFCFTA TOOLS, AND LAWYER LISTINGS IS
            AT YOUR OWN RISK.
          </PolicyCallout>

          <PolicySectionHeading number="10" title="Limitation of Liability" />
          <PolicyP>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE (AND OUR AFFILIATES, OFFICERS,
            EMPLOYEES, AND AGENTS) SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, DATA, OR GOODWILL, ARISING
            FROM YOUR USE OF OR INABILITY TO USE THE PLATFORM. OUR TOTAL LIABILITY FOR ANY CLAIMS
            ARISING OUT OF OR RELATED TO THESE TERMS OR THE PLATFORM SHALL NOT EXCEED THE AMOUNT YOU
            PAID US IN THE TWELVE (12) MONTHS BEFORE THE CLAIM (OR, IF GREATER, ONE HUNDRED US
            DOLLARS). SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS; IN SUCH CASES OUR
            LIABILITY WILL BE LIMITED TO THE MAXIMUM EXTENT PERMITTED BY LAW.
          </PolicyP>

          <PolicySectionHeading number="11" title="Indemnity" />
          <PolicyP>
            You agree to indemnify and hold harmless Yamalé Legal Platform and its affiliates,
            officers, employees, and agents from any claims, damages, losses, or expenses (including
            reasonable legal fees) arising from your use of the Platform, your breach of these
            Terms, or your violation of any law or third-party rights.
          </PolicyP>

          <PolicySectionHeading number="12" title="Termination" />
          <PolicyP>
            We may suspend or terminate your access to the Platform at any time, with or without
            cause or notice. You may stop using the Platform at any time. On termination, your right
            to use the Platform ceases; provisions that by their nature should survive (for example,
            disclaimers, limitation of liability, indemnity, governing law) will survive.
          </PolicyP>

          <PolicySectionHeading number="13" title="Governing Law and Disputes" />
          <PolicyP>
            These Terms are governed by the laws of the jurisdiction in which Yamalé Legal Platform
            operates, without regard to conflict-of-law principles. Any dispute arising out of or
            relating to these Terms or the Platform shall be resolved in the courts of that
            jurisdiction, except where prohibited. You may also have rights under consumer
            protection laws in your country that cannot be waived by contract.
          </PolicyP>

          <PolicySectionHeading number="14" title="Changes to the Terms" />
          <PolicyP>
            We may modify these Terms from time to time. We will post the updated Terms on this page
            and update the &ldquo;Last updated&rdquo; date. Your continued use of the Platform after
            changes constitutes acceptance. For material changes, we may provide additional notice
            (for example, by email or in-product notice) where required by law.
          </PolicyP>

          <PolicySectionHeading number="15" title="Contact" />
          <PolicyP>
            For questions about these Terms, contact us at <PolicyMailLink email="info@yamalealliance.org" />.
          </PolicyP>

          <PolicyUpdatedBanner>
            These Terms of Service were last updated on <strong>February 12, 2026</strong>. Please review them
            periodically for updates.
          </PolicyUpdatedBanner>
        </div>

        <PolicyFooterNav
          links={[
            { href: "/privacy", label: "Privacy Policy" },
            { href: "/payment-refund", label: "Payment & Refund Policy" },
            { href: "/", label: "Home" },
          ]}
        />
      </div>
    </div>
  );
}
