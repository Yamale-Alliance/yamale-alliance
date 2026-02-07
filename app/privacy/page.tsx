import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Yamalé Legal Platform",
  description: "Privacy Policy for Yamalé Legal Platform – how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <a href="/" className="text-sm text-muted-foreground hover:text-primary hover:underline">
          ← Back to home
        </a>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p className="mt-2">
              Yamalé Legal Platform (“we”, “us”, “our”) operates the Yamalé Legal Platform website and services, which provide African legal research, AfCFTA compliance tools, AI-powered legal research, a legal library, a lawyer directory (“Find a Lawyer”), and a marketplace for legal and compliance resources. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services. By using our platform, you agree to the practices described here. If you do not agree, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>
            <p className="mt-2">
              We may collect the following categories of information:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
              <li><strong>Account and identity:</strong> Name, email address, and other details you provide when signing up or managing your account (via our authentication provider).</li>
              <li><strong>Profile and contact (lawyers):</strong> If you register as a lawyer, we store profile information you provide, such as email, phone number, practice area, country, pronouns, and profile picture. We also store metadata for documents you upload (e.g. degree, license, bar certificate) and the documents themselves in secure storage.</li>
              <li><strong>Usage and product:</strong> How you use our platform (e.g. AI research queries, pages visited, subscription tier, AI usage such as query count and token usage for the purpose of plan limits and admin reporting).</li>
              <li><strong>Payment:</strong> Payment-related data is processed by our payment provider (e.g. Stripe). We may store references to transactions (e.g. subscription tier, lawyer unlock or day-pass purchases) for billing and support.</li>
              <li><strong>Communications:</strong> If you contact us (e.g. at it@yamalealliance.org), we may keep records of that correspondence.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. How We Use Your Information</h2>
            <p className="mt-2">
              We use the information we collect to:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
              <li>Provide, operate, and improve our services (legal library, AfCFTA tools, AI research, lawyer directory, marketplace, and subscriptions).</li>
              <li>Authenticate you and manage your account and profile.</li>
              <li>Process payments and enforce subscription and unlock rules (e.g. lawyer contact unlock, day pass).</li>
              <li>Display lawyer profiles (including name, practice, country, contact details when unlocked, profile picture, pronouns) to users on the Find a Lawyer page and to admins for verification.</li>
              <li>Enforce usage limits (e.g. AI research credits/tokens per plan) and provide usage-related reporting to administrators.</li>
              <li>Comply with legal obligations, protect our rights, and ensure security and fraud prevention.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Sharing and Disclosure</h2>
            <p className="mt-2">
              We may share your information with:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
              <li><strong>Service providers:</strong> Authentication (e.g. Clerk), database and file storage (e.g. Supabase), payments (e.g. Stripe), and AI for research (e.g. Anthropic). These providers process data on our behalf under contractual obligations.</li>
              <li><strong>Other users:</strong> If you are a lawyer, your profile (name, practice, country, contact when unlocked, profile picture, pronouns) may be shown to platform users. Contact details are only revealed to users who have unlocked your profile (e.g. via payment).</li>
              <li><strong>Legal and safety:</strong> Where required by law, or to protect our rights, safety, or the safety of others.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Data Retention and Security</h2>
            <p className="mt-2">
              We retain your information for as long as your account is active or as needed to provide the services, comply with law, or resolve disputes. We implement appropriate technical and organisational measures to protect your data. No system is completely secure; you provide information at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Your Rights</h2>
            <p className="mt-2">
              Depending on your location (e.g. GDPR, other data protection laws), you may have the right to:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
              <li>Access and receive a copy of your personal data.</li>
              <li>Correct or update your data (e.g. via your profile or account settings).</li>
              <li>Request deletion of your data, subject to legal and operational requirements.</li>
              <li>Object to or restrict certain processing.</li>
              <li>Data portability where applicable.</li>
            </ul>
            <p className="mt-2">
              To exercise these rights or ask questions about your data, contact us at{" "}
              <a href="mailto:it@yamalealliance.org" className="text-primary underline hover:no-underline">it@yamalealliance.org</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Cookies and Similar Technologies</h2>
            <p className="mt-2">
              We and our service providers may use cookies and similar technologies for authentication, security, and to improve the platform. You can adjust your browser settings to limit or block cookies; some features may not work correctly if you disable them.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. International Transfers</h2>
            <p className="mt-2">
              Your data may be processed in countries other than your own. We ensure appropriate safeguards (e.g. contracts, adequacy decisions) where required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Children</h2>
            <p className="mt-2">
              Our services are not directed at minors. We do not knowingly collect personal data from children. If you believe we have collected such data, please contact us and we will take steps to delete it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. We will post the updated version on this page and update the “Last updated” date. Continued use of the platform after changes constitutes acceptance of the revised policy. For material changes, we may provide additional notice where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Contact</h2>
            <p className="mt-2">
              For privacy-related questions or requests, contact us at{" "}
              <a href="mailto:it@yamalealliance.org" className="text-primary underline hover:no-underline">it@yamalealliance.org</a>.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <a href="/terms" className="text-sm text-primary hover:underline">
            Terms of Service
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
