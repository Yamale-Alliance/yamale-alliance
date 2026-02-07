import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Yamalé Legal Platform",
  description: "Terms of Service for Yamalé Legal Platform – rules and conditions for using our services.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <a href="/" className="text-sm text-muted-foreground hover:text-primary hover:underline">
          ← Back to home
        </a>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p className="mt-2">
              By accessing or using Yamalé Legal Platform (“Platform”, “we”, “us”, “our”), including our website, legal library, AfCFTA tools, AI legal research, Find a Lawyer directory, marketplace, and any related services, you agree to be bound by these Terms of Service (“Terms”). If you do not agree, you must not use the Platform. Additional terms may apply to specific features (e.g. payments, lawyer verification); those terms are incorporated by reference.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Description of Services</h2>
            <p className="mt-2">
              Yamalé Legal Platform provides:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
              <li><strong>Legal Library:</strong> Browse and access African legal materials by jurisdiction and domain.</li>
              <li><strong>AfCFTA Tools:</strong> Cross-border compliance tools, sector checklists, and rules-of-origin style guidance.</li>
              <li><strong>AI Legal Research:</strong> AI-powered research assistance for African law and compliance. Responses are indicative and do not constitute legal advice.</li>
              <li><strong>Find a Lawyer:</strong> Directory of verified legal professionals. Contact details may be unlocked by payment (per-lawyer or day pass) as described on the platform.</li>
              <li><strong>Marketplace:</strong> Digital products (e.g. books, courses, templates) for legal and compliance use. Claims and access are subject to payment and any item-specific terms.</li>
              <li><strong>Subscriptions and payments:</strong> Subscription plans (e.g. Basic, Pro, Team) and one-off purchases (e.g. lawyer unlock, day pass, marketplace items) as described on the pricing and checkout pages.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Accounts and Eligibility</h2>
            <p className="mt-2">
              You must be at least 18 years old and able to form a binding contract to use the Platform. You are responsible for keeping your account credentials secure and for all activity under your account. You must provide accurate and complete information when registering. Lawyers must complete verification and profile requirements; we may approve, reject, or remove listings at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Subscriptions and Payments</h2>
            <p className="mt-2">
              Subscription fees, one-off payments (e.g. lawyer unlock, day pass, marketplace purchases), and billing cycles are as displayed at the time of purchase. Payments are processed by our payment provider (e.g. Stripe). By purchasing, you agree to the applicable pricing and refund policy (if any) stated on the platform. We may change fees with notice where required; continued use after changes may constitute acceptance. Subscription and usage limits (e.g. AI research credits) are enforced as described in the product and in our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Find a Lawyer and Unlock</h2>
            <p className="mt-2">
              The lawyer directory is for informational and contact purposes. Listing does not guarantee availability or suitability. Unlocking a lawyer’s contact (per-lawyer or via day pass) grants you access to the contact details displayed at the time of unlock. We do not guarantee outcomes of any engagement with lawyers. Any agreement between you and a lawyer is solely between you and that lawyer; we are not a party to such agreements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. AI Research – Not Legal Advice</h2>
            <p className="mt-2">
              AI legal research on the Platform is for general information and research only. It does not constitute legal, tax, or professional advice. Responses may be incomplete, outdated, or not applicable to your situation. You must not rely on AI output as a substitute for advice from a qualified lawyer or other professional. We recommend consulting a qualified professional for any specific legal or compliance matter.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Acceptable Use</h2>
            <p className="mt-2">
              You agree not to:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
              <li>Use the Platform in violation of any applicable law or regulation.</li>
              <li>Infringe the intellectual property or other rights of us or any third party.</li>
              <li>Transmit malware, spam, or harmful or illegal content.</li>
              <li>Attempt to gain unauthorised access to our systems, other accounts, or third-party services.</li>
              <li>Scrape, automate access, or overload the Platform in a way that impairs its operation.</li>
              <li>Use the Platform to harass, defame, or harm others.</li>
            </ul>
            <p className="mt-2">
              We may suspend or terminate access for breach of these Terms or for any other reason we consider necessary.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Intellectual Property</h2>
            <p className="mt-2">
              The Platform (including design, text, software, and our branding) is owned or licensed by us. You may not copy, modify, distribute, or create derivative works without our prior written consent. Legal and marketplace content may be subject to third-party rights; your use must comply with any licences or terms shown for that content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Disclaimers</h2>
            <p className="mt-2">
              THE PLATFORM AND ALL CONTENT AND SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE”. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS. USE OF AI RESEARCH, THE LEGAL LIBRARY, AFCCTA TOOLS, AND LAWYER LISTINGS IS AT YOUR OWN RISK.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Limitation of Liability</h2>
            <p className="mt-2">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE (AND OUR AFFILIATES, OFFICERS, EMPLOYEES, AND AGENTS) SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF OR INABILITY TO USE THE PLATFORM. OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE PLATFORM SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS BEFORE THE CLAIM (OR, IF GREATER, ONE HUNDRED US DOLLARS). SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS; IN SUCH CASES OUR LIABILITY WILL BE LIMITED TO THE MAXIMUM EXTENT PERMITTED BY LAW.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Indemnity</h2>
            <p className="mt-2">
              You agree to indemnify and hold harmless Yamalé Legal Platform and its affiliates, officers, employees, and agents from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your use of the Platform, your breach of these Terms, or your violation of any law or third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">12. Termination</h2>
            <p className="mt-2">
              We may suspend or terminate your access to the Platform at any time, with or without cause or notice. You may stop using the Platform at any time. On termination, your right to use the Platform ceases; provisions that by their nature should survive (e.g. disclaimers, limitation of liability, indemnity, governing law) will survive.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">13. Governing Law and Disputes</h2>
            <p className="mt-2">
              These Terms are governed by the laws of the jurisdiction in which Yamalé Legal Platform operates, without regard to conflict-of-law principles. Any dispute arising out of or relating to these Terms or the Platform shall be resolved in the courts of that jurisdiction, except where prohibited. You may also have rights under consumer protection laws in your country that cannot be waived by contract.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">14. Changes to the Terms</h2>
            <p className="mt-2">
              We may modify these Terms from time to time. We will post the updated Terms on this page and update the “Last updated” date. Your continued use of the Platform after changes constitutes acceptance. For material changes, we may provide additional notice (e.g. by email or in-product notice) where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">15. Contact</h2>
            <p className="mt-2">
              For questions about these Terms, contact us at{" "}
              <a href="mailto:it@yamalealliance.org" className="text-primary underline hover:no-underline">it@yamalealliance.org</a>.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <a href="/privacy" className="text-sm text-primary hover:underline">
            Privacy Policy
          </a>
          <span className="mx-2 text-muted-foreground">·</span>
          <a href="/" className="text-sm text-primary hover:underline">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}
