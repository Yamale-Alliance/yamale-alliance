import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Yamalé Legal Platform",
  description:
    "Privacy Policy for Yamalé Legal Platform – how we collect, use, and protect your data.",
};

/* ── brand tokens (matches lawyer / marketplace pages) ── */
const BRAND = {
  dark: "#221913",
  medium: "#603b1c",
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
  accent: "#e3ba65",
};

/* ── tiny reusable components ── */

function SectionHeading({ id, number, title }: { id?: string; number: string; title: string }) {
  return (
    <h2
      id={id}
      className="mt-12 mb-4 text-2xl font-bold scroll-mt-24"
      style={{ color: BRAND.dark }}
    >
      {number}. {title}
    </h2>
  );
}

function SubHeading({ number, title }: { number: string; title: string }) {
  return (
    <h3 className="mt-8 mb-3 text-lg font-bold" style={{ color: BRAND.medium }}>
      {number} {title}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[15px] leading-relaxed text-foreground/90">{children}</p>;
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mb-4 space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i} className="text-[15px] leading-relaxed text-foreground/90 list-disc marker:text-[#c18c43]">
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
      <span className="mb-1 block text-sm font-bold uppercase tracking-wide" style={{ color: BRAND.medium }}>
        {label}
      </span>
      <div className="text-[15px] leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}

function LabelBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <span className="mb-1 block text-sm font-bold uppercase tracking-wide" style={{ color: BRAND.medium }}>
        {label}
      </span>
      <div className="text-[15px] leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}

/* ── page ── */

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Hero banner */}
      <div
        className="py-16 text-white"
        style={{ background: `linear-gradient(135deg, ${BRAND.dark} 0%, ${BRAND.medium} 100%)` }}
      >
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-3 text-lg opacity-90">
            How Yamalé collects, uses, and protects your data
          </p>
          <p className="mt-2 text-sm" style={{ color: BRAND.accent }}>
            Last updated: February 12, 2026
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-xl bg-white dark:bg-card shadow-md border border-border p-8 sm:p-10">
          {/* ─── 1. Introduction ─── */}
          <SectionHeading id="introduction" number="1" title="Introduction" />
          <P>
            Yamalé Legal Platform (&ldquo;Yamalé&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
            &ldquo;our&rdquo;) operates the Yamalé Legal Platform website and mobile applications
            (collectively, the &ldquo;Platform&rdquo;), which provide African legal research, AfCFTA
            compliance tools, AI-powered legal research, a comprehensive legal document library, a
            verified lawyer directory, and a marketplace for legal and compliance resources.
          </P>
          <P>
            This Privacy Policy explains how we collect, use, disclose, and safeguard your personal
            information when you use our Platform and services. We are committed to protecting your
            privacy and handling your data transparently and responsibly.
          </P>
          <P>
            By accessing or using the Platform, you acknowledge that you have read, understood, and
            agree to be bound by this Privacy Policy. If you do not agree with any part of this
            policy, please do not use our services.
          </P>

          {/* ─── 2. Information We Collect ─── */}
          <SectionHeading id="info-collect" number="2" title="Information We Collect" />
          <P>We collect various types of information to provide and improve our services:</P>

          <SubHeading number="2.1" title="Account and Identity Information" />
          <P>When you create an account, we collect:</P>
          <BulletList
            items={[
              "Full name",
              "Email address",
              "Password (encrypted)",
              "Account preferences and settings",
              "Subscription tier and billing information",
              "Authentication data provided through our authentication service provider",
            ]}
          />

          <SubHeading number="2.2" title="Lawyer Profile Information (For Legal Professionals)" />
          <P>If you register as a lawyer in our directory, we collect and store:</P>
          <BulletList
            items={[
              "Professional information: Full name, law firm name, title/position, practice areas, years of experience, bar admission details",
              "Contact information: Business email address, phone number, office address",
              "Geographic information: Country, city, and regions where you practice",
              "Languages spoken",
              "Educational background and qualifications",
              "Profile picture (optional)",
              "Professional pronouns (optional)",
              "Verification documents: Bar certificates, licenses, degrees, and other credentials (stored securely and used only for verification purposes)",
              "Rating and review data from platform users",
            ]}
          />
          <Callout label="Important">
            Your contact information (email, phone, office address) and full law firm name are{" "}
            <strong>hidden</strong> from other users by default. This information is only revealed to
            users who pay to unlock your profile. Your practice areas, location, experience,
            languages, and other professional details remain visible to help users find the right
            lawyer for their needs.
          </Callout>

          <SubHeading number="2.3" title="Usage and Activity Information" />
          <P>We automatically collect information about how you interact with our Platform:</P>
          <BulletList
            items={[
              "Pages viewed and documents accessed",
              "Search queries and filters used",
              "AI research queries and conversations",
              "Document downloads and exports",
              "AfCFTA reports generated",
              "Lawyer directory searches and filters applied",
              "Lawyer profiles unlocked (including payment information)",
              "Day pass purchases and usage",
              "Feature usage statistics (e.g., number of AI queries, documents saved)",
              "Time spent on the Platform",
              "Device information: IP address, browser type, operating system, device identifiers",
              "Log data: Access times, errors, and system activity",
            ]}
          />

          <SubHeading number="2.4" title="Payment and Transaction Information" />
          <P>
            We process payments through secure third-party payment processors (such as pawaPay). We do{" "}
            <strong>NOT</strong> store your complete credit card information on our servers. We
            collect and store:
          </P>
          <BulletList
            items={[
              "Subscription tier and status",
              "Transaction history and receipts",
              "Lawyer profile unlock purchases",
              "Day pass purchases",
              "Pay-as-you-go usage records",
              "Billing address",
              "Payment method type (last 4 digits only)",
              "Mobile money transaction references (where applicable)",
            ]}
          />
          <P>
            Our payment processors collect and process full payment card details in compliance with
            PCI DSS standards.
          </P>

          <SubHeading number="2.5" title="Communications and Correspondence" />
          <P>If you contact us for support or inquiries:</P>
          <BulletList
            items={[
              "Email correspondence with our support team (it@yamalealliance.org)",
              "Customer support tickets and chat messages",
              "Feedback and survey responses",
              "Messages sent through the Platform",
            ]}
          />

          <SubHeading number="2.6" title="Marketplace Activity" />
          <P>When you use our marketplace for legal resources:</P>
          <BulletList
            items={[
              "Purchase history of templates, courses, and toolkits",
              "Downloaded resources",
              "Reviews and ratings you provide",
              "Seller information (if you list products)",
            ]}
          />

          {/* ─── 3. How We Use Your Information ─── */}
          <SectionHeading id="how-use" number="3" title="How We Use Your Information" />
          <P>We use the information we collect for the following purposes:</P>

          <SubHeading number="3.1" title="To Provide and Maintain Our Services" />
          <BulletList
            items={[
              "Authenticate your identity and manage your account",
              "Process and fulfill your subscription",
              "Provide access to legal documents, research tools, and AI features",
              "Generate AfCFTA compliance reports",
              "Display lawyer profiles in our directory (with appropriate privacy controls)",
              "Process lawyer profile unlock payments and reveal contact information to paying users",
              "Facilitate marketplace transactions",
              "Track usage limits according to your subscription tier",
              "Enable document downloads and exports",
            ]}
          />

          <SubHeading number="3.2" title="To Process Payments and Enforce Subscription Rules" />
          <BulletList
            items={[
              "Process monthly or annual subscription payments",
              "Process one-time payments for lawyer contact unlocks",
              "Process day pass purchases ($9.99 for 24-hour access)",
              "Process pay-as-you-go charges (documents, AI queries, reports)",
              "Manage billing disputes and refunds",
              "Enforce usage limits and tier restrictions",
              "Prevent payment fraud",
            ]}
          />

          <SubHeading number="3.3" title="To Operate the Lawyer Directory" />
          <BulletList
            items={[
              "Display lawyer profiles to users searching for legal professionals",
              "Show public information: initials (before unlock), title, practice areas, location, experience, languages, education, bar admission, ratings",
              "HIDE sensitive information until payment: full name, law firm name, email, phone, office address",
              "Verify lawyer credentials and maintain directory quality",
              "Enable search and filtering by location, expertise, and language",
              "Facilitate connections between users and legal professionals after payment",
              "Track which users have unlocked which lawyer profiles",
            ]}
          />

          <SubHeading number="3.4" title="To Improve and Personalize Our Platform" />
          <BulletList
            items={[
              "Analyze usage patterns and trends",
              "Develop new features and services",
              "Enhance AI research capabilities",
              "Improve search and discovery",
              "Personalize content recommendations",
              "Optimize Platform performance",
              "Conduct internal research and analytics",
            ]}
          />

          <SubHeading number="3.5" title="To Communicate with You" />
          <BulletList
            items={[
              "Send transactional emails (account creation, password resets, purchase confirmations)",
              "Provide customer support and respond to inquiries",
              "Send subscription renewal reminders",
              "Notify you of Platform updates and new features (with option to opt out)",
              "Send legal and compliance notices",
              "Conduct user surveys (optional participation)",
            ]}
          />

          <SubHeading number="3.6" title="For Legal Compliance and Security" />
          <BulletList
            items={[
              "Comply with legal obligations and regulatory requirements",
              "Enforce our Terms of Service and other policies",
              "Protect against fraud, abuse, and unauthorized access",
              "Resolve disputes and prevent illegal activities",
              "Protect the rights, property, and safety of Yamalé, our users, and the public",
              "Respond to legal requests from authorities",
            ]}
          />

          {/* ─── 4. How We Share Your Information ─── */}
          <SectionHeading id="sharing" number="4" title="How We Share Your Information" />
          <P>
            We may share your information with third parties in the following circumstances:
          </P>

          <SubHeading number="4.1" title="Service Providers and Business Partners" />
          <P>
            We share information with trusted third-party service providers who help us operate the
            Platform:
          </P>
          <BulletList
            items={[
              "Authentication services (e.g., Clerk, Auth0) — to manage user accounts and login",
              "Database and storage providers (e.g., Supabase, AWS) — to store Platform data and documents",
              "Payment processors (e.g., pawaPay, mobile money providers) — to process subscription and unlock payments",
              "AI providers (e.g., Anthropic Claude) — to power our AI legal research features",
              "Email service providers — to send transactional and notification emails",
              "Analytics providers — to understand Platform usage and performance",
              "Cloud infrastructure providers — to host and operate the Platform",
              "Customer support tools — to provide assistance",
            ]}
          />
          <P>
            These service providers are contractually obligated to protect your information and use it
            only for the specific services they provide to us. They cannot use your data for their own
            purposes.
          </P>

          <SubHeading number="4.2" title="Other Platform Users (Lawyer Directory)" />
          <P>If you are a registered lawyer:</P>
          <LabelBlock label="Publicly visible information (shown to all users)">
            <BulletList
              items={[
                'Your initials (e.g., "C. A." instead of full name)',
                'Professional title (e.g., "Senior Partner")',
                "Practice areas and expertise",
                "City and country",
                "Years of experience",
                "Languages spoken",
                "Bar admission year",
                "Educational background",
                "Star rating and number of reviews",
                "Verification badge status",
              ]}
            />
          </LabelBlock>
          <LabelBlock label="Hidden information (only revealed after payment)">
            <BulletList
              items={[
                "Your full first and last name",
                "Complete law firm name",
                "Email address",
                "Phone number",
                "Office address",
              ]}
            />
          </LabelBlock>
          <P>
            When a user pays to unlock your profile, they receive permanent access to your contact
            information. We notify you when your profile is unlocked and provide the unlocking
            user&apos;s name and email so you can expect their contact.
          </P>
          <P>
            Users who unlock your profile may contact you directly outside the Platform. We are not
            responsible for how they use your contact information after it is revealed.
          </P>

          <SubHeading number="4.3" title="Legal Requirements and Protection of Rights" />
          <P>
            We may disclose your information when required by law or when necessary to:
          </P>
          <BulletList
            items={[
              "Comply with court orders, subpoenas, or legal processes",
              "Respond to requests from government authorities or law enforcement",
              "Enforce our Terms of Service, policies, or user agreements",
              "Protect the rights, property, or safety of Yamalé, our users, or others",
              "Investigate and prevent fraud, security breaches, or illegal activities",
              "Defend against legal claims or litigation",
            ]}
          />

          <SubHeading number="4.4" title="Business Transfers" />
          <P>
            If Yamalé is involved in a merger, acquisition, sale of assets, bankruptcy, or similar
            business transaction, your information may be transferred to the acquiring entity. We will
            notify you of any such change and provide information about your choices regarding your
            data.
          </P>

          <SubHeading number="4.5" title="With Your Consent" />
          <P>
            We may share your information for other purposes with your explicit consent or at your
            direction.
          </P>

          {/* ─── 5. Data Retention ─── */}
          <SectionHeading id="retention" number="5" title="Data Retention" />
          <P>
            We retain your personal information for as long as necessary to fulfill the purposes
            outlined in this Privacy Policy, unless a longer retention period is required or
            permitted by law.
          </P>
          <LabelBlock label="Active Accounts">
            We retain your account information and usage data while your account is active.
          </LabelBlock>
          <LabelBlock label="Lawyer Profiles">
            Lawyer profile information is retained as long as you maintain your listing in the
            directory. Verification documents are retained for regulatory compliance.
          </LabelBlock>
          <LabelBlock label="Transaction Records">
            Payment and transaction records are retained for at least 7 years for tax, accounting,
            and legal compliance purposes.
          </LabelBlock>
          <LabelBlock label="Unlocked Contacts">
            Records of lawyer profile unlocks are retained indefinitely to prevent duplicate charges
            and maintain service history.
          </LabelBlock>
          <LabelBlock label="After Account Deletion">
            <p className="mb-2">
              When you delete your account, we will delete or anonymize your personal information
              within 90 days, except for information we are required to retain for legal, tax, audit,
              or security purposes. This includes:
            </p>
            <BulletList
              items={[
                "Transaction records (7 years)",
                "Legal compliance documents",
                "Anonymized usage data for analytics",
                "Information necessary to prevent fraud or enforce our Terms",
              ]}
            />
          </LabelBlock>
          <LabelBlock label="Lawyer Profile Deletion">
            If you are a lawyer and request profile deletion, contact information revealed to users
            who previously unlocked your profile will remain with those users, as the transaction was
            completed. We will remove your profile from active search results within 30 days.
          </LabelBlock>

          {/* ─── 6. Data Security ─── */}
          <SectionHeading id="security" number="6" title="Data Security" />
          <P>
            We implement appropriate technical, administrative, and physical security measures to
            protect your personal information from unauthorized access, disclosure, alteration, and
            destruction.
          </P>
          <LabelBlock label="Technical Safeguards">
            <BulletList
              items={[
                "Encryption of data in transit (TLS/SSL) and at rest",
                "Secure authentication systems with password hashing",
                "Regular security audits and vulnerability assessments",
                "Firewall protection and intrusion detection systems",
                "Secure API access controls",
                "Regular software updates and security patches",
              ]}
            />
          </LabelBlock>
          <LabelBlock label="Administrative Safeguards">
            <BulletList
              items={[
                "Employee training on data protection and privacy",
                "Access controls limiting who can view personal information",
                "Background checks for employees with data access",
                "Incident response procedures",
                "Regular policy reviews and updates",
              ]}
            />
          </LabelBlock>
          <LabelBlock label="Physical Safeguards">
            <BulletList
              items={[
                "Secure data centers with restricted access",
                "Environmental controls and redundancy",
                "Secure disposal of physical records",
              ]}
            />
          </LabelBlock>
          <LabelBlock label="Payment Security">
            We use PCI DSS-compliant payment processors. We do not store complete credit card
            numbers on our servers.
          </LabelBlock>
          <Callout label="Important Limitation">
            While we implement strong security measures, no system is 100% secure. You provide
            information at your own risk. We cannot guarantee absolute security, and we are not
            responsible for unauthorized access resulting from circumstances beyond our reasonable
            control.
          </Callout>
          <Callout label="Your Responsibility">
            You are responsible for maintaining the confidentiality of your account credentials.
            Never share your password, and notify us immediately if you suspect unauthorized account
            access.
          </Callout>

          {/* ─── 7. Your Rights and Choices ─── */}
          <SectionHeading id="rights" number="7" title="Your Rights and Choices" />
          <P>
            Depending on your location and applicable data protection laws (including GDPR, CCPA, and
            African data protection regulations), you may have the following rights:
          </P>

          <SubHeading number="7.1" title="Right to Access" />
          <P>
            You have the right to request access to the personal information we hold about you and
            receive a copy in a structured, commonly used format.
          </P>

          <SubHeading number="7.2" title="Right to Correction" />
          <P>
            You can update most of your account information directly through your profile settings.
            For lawyer profiles, you can update your practice information, contact details, and other
            profile data. If you cannot update information yourself, contact us at{" "}
            <a href="mailto:it@yamalealliance.org" className="font-medium underline" style={{ color: BRAND.gradientEnd }}>
              it@yamalealliance.org
            </a>
            .
          </P>

          <SubHeading number="7.3" title="Right to Deletion" />
          <P>
            You may request deletion of your personal information, subject to certain exceptions
            (e.g., legal obligations, fraud prevention, transaction records). To delete your account,
            contact us at{" "}
            <a href="mailto:it@yamalealliance.org" className="font-medium underline" style={{ color: BRAND.gradientEnd }}>
              it@yamalealliance.org
            </a>
            .
          </P>
          <Callout label="Note for Lawyers">
            If users have previously unlocked your profile, they will retain access to the contact
            information they paid for. We cannot retrieve information that has already been disclosed
            through a completed transaction.
          </Callout>

          <SubHeading number="7.4" title="Right to Object and Restrict Processing" />
          <P>
            You may object to certain processing of your personal information or request that we
            restrict processing in certain circumstances, such as when you contest the accuracy of
            your data or the lawfulness of processing.
          </P>

          <SubHeading number="7.5" title="Right to Data Portability" />
          <P>
            Where applicable, you have the right to receive your personal information in a portable
            format and transmit it to another service provider.
          </P>

          <SubHeading number="7.6" title="Right to Withdraw Consent" />
          <P>
            Where we process your information based on consent, you have the right to withdraw that
            consent at any time. This will not affect the lawfulness of processing before withdrawal.
          </P>

          <SubHeading number="7.7" title="Marketing Communications" />
          <P>
            You can opt out of marketing emails by clicking the &ldquo;unsubscribe&rdquo; link in any
            marketing email or by updating your communication preferences in your account settings.
            You will continue to receive transactional emails (e.g., receipts, password resets) even
            if you opt out of marketing.
          </P>

          <SubHeading number="7.8" title="How to Exercise Your Rights" />
          <P>
            To exercise any of these rights, please contact us at{" "}
            <a href="mailto:it@yamalealliance.org" className="font-medium underline" style={{ color: BRAND.gradientEnd }}>
              it@yamalealliance.org
            </a>
            . We will respond to your request within the timeframe required by applicable law
            (typically 30 days). We may need to verify your identity before processing your request.
          </P>

          {/* ─── 8. Cookies ─── */}
          <SectionHeading id="cookies" number="8" title="Cookies and Similar Technologies" />
          <P>
            We and our service providers use cookies, web beacons, and similar tracking technologies
            to:
          </P>
          <BulletList
            items={[
              "Authenticate users and maintain login sessions",
              "Remember your preferences and settings",
              "Analyze Platform usage and performance",
              "Provide security and detect fraud",
              "Deliver and measure the effectiveness of features",
            ]}
          />
          <LabelBlock label="Types of Cookies We Use">
            <BulletList
              items={[
                <span key="e"><strong>Essential Cookies:</strong> Required for the Platform to function (authentication, security, session management)</span>,
                <span key="f"><strong>Functional Cookies:</strong> Remember your preferences and settings</span>,
                <span key="a"><strong>Analytics Cookies:</strong> Help us understand how you use the Platform</span>,
                <span key="s"><strong>Security Cookies:</strong> Detect and prevent fraudulent activity</span>,
              ]}
            />
          </LabelBlock>
          <LabelBlock label="Managing Cookies">
            Most web browsers accept cookies by default. You can adjust your browser settings to
            refuse cookies or alert you when cookies are being sent. However, some features of the
            Platform may not function properly if you disable cookies, particularly authentication and
            session management.
          </LabelBlock>
          <LabelBlock label="Third-Party Cookies">
            Some cookies may be set by our service providers (e.g., analytics tools). These third
            parties have their own privacy policies governing their use of your information.
          </LabelBlock>

          {/* ─── 9. Third-Party Links ─── */}
          <SectionHeading id="third-party" number="9" title="Third-Party Links and Services" />
          <P>
            Our Platform may contain links to third-party websites, applications, or services
            (including resources in our marketplace, external legal databases, or social media
            platforms). We are not responsible for the privacy practices or content of these third
            parties.
          </P>
          <P>
            When you click on a third-party link or access a third-party service, you leave our
            Platform and are subject to that third party&apos;s privacy policy and terms of service.
            We encourage you to read the privacy policies of any third-party services you visit.
          </P>
          <LabelBlock label="Marketplace Resources">
            When you purchase templates, courses, or other resources from third-party sellers in our
            marketplace, the seller may collect additional information from you. We facilitate the
            transaction but are not responsible for the seller&apos;s privacy practices.
          </LabelBlock>

          {/* ─── 10. International Data Transfers ─── */}
          <SectionHeading id="transfers" number="10" title="International Data Transfers" />
          <P>
            Yamalé operates internationally and your information may be transferred to, stored in, and
            processed in countries other than your country of residence, including other countries in
            Africa, the United States, Europe, and other regions where our service providers operate.
          </P>
          <P>
            These countries may have data protection laws that differ from the laws of your country.
            When we transfer your personal information internationally, we implement appropriate
            safeguards to protect your data, including:
          </P>
          <BulletList
            items={[
              "Standard Contractual Clauses (SCCs) approved by relevant authorities",
              "Data processing agreements with service providers",
              "Adequacy decisions by relevant data protection authorities",
              "Other legally recognized transfer mechanisms",
            ]}
          />
          <P>
            Where required by law, we will obtain your consent before transferring your information
            internationally.
          </P>
          <Callout label="For African Users">
            We strive to store African user data within Africa or in jurisdictions with adequate data
            protection standards. However, some of our service providers (particularly AI and cloud
            infrastructure providers) may process data outside Africa. We ensure these providers
            comply with applicable data protection requirements.
          </Callout>

          {/* ─── 11. Children's Privacy ─── */}
          <SectionHeading id="children" number="11" title="Children's Privacy" />
          <P>
            Our Platform is not intended for use by individuals under the age of 18 (or the minimum
            age of digital consent in your jurisdiction). We do not knowingly collect personal
            information from children.
          </P>
          <P>
            If you are a parent or guardian and believe your child has provided personal information to
            us, please contact us immediately at{" "}
            <a href="mailto:it@yamalealliance.org" className="font-medium underline" style={{ color: BRAND.gradientEnd }}>
              it@yamalealliance.org
            </a>
            . Upon verification, we will promptly delete such information from our systems.
          </P>

          {/* ─── 12. Contact ─── */}
          <SectionHeading id="contact" number="12" title="Data Protection Officer and Contact Information" />
          <P>
            If you have questions, concerns, or requests regarding this Privacy Policy or our data
            practices, please contact us:
          </P>
          <div className="my-4 rounded-lg border border-border bg-gray-50 dark:bg-muted/30 p-5 space-y-2 text-[15px]">
            <p>
              <strong style={{ color: BRAND.medium }}>Email:</strong>{" "}
              <a href="mailto:it@yamalealliance.org" className="font-medium underline" style={{ color: BRAND.gradientEnd }}>
                it@yamalealliance.org
              </a>
            </p>
            <p>
              <strong style={{ color: BRAND.medium }}>Subject Line:</strong> Privacy Inquiry — [Your
              Topic]
            </p>
          </div>
          <LabelBlock label="Data Protection Officer">
            For GDPR or other data protection inquiries, you may request to speak with our Data
            Protection Officer by emailing{" "}
            <a href="mailto:it@yamalealliance.org" className="font-medium underline" style={{ color: BRAND.gradientEnd }}>
              it@yamalealliance.org
            </a>{" "}
            with the subject line &ldquo;Attention: DPO&rdquo;.
          </LabelBlock>
          <LabelBlock label="Response Time">
            We aim to respond to all privacy inquiries within 30 days. For complex requests, we may
            extend this period and will notify you of the extension.
          </LabelBlock>
          <LabelBlock label="Right to Lodge a Complaint">
            If you are located in the European Union, United Kingdom, or another jurisdiction with a
            data protection authority, you have the right to lodge a complaint with your local
            supervisory authority if you believe we have violated your data protection rights.
          </LabelBlock>

          {/* ─── 13. Changes ─── */}
          <SectionHeading id="changes" number="13" title="Changes to This Privacy Policy" />
          <P>
            We may update this Privacy Policy from time to time to reflect changes in our practices,
            services, legal requirements, or for other operational, legal, or regulatory reasons.
          </P>
          <LabelBlock label="Notification of Changes">
            <p className="mb-2">When we make changes, we will:</p>
            <BulletList
              items={[
                'Update the "Last Updated" date at the top of this policy',
                "Post the revised policy on our Platform",
                "For material changes that significantly affect your rights, we will provide additional notice through email or a prominent notice on the Platform",
              ]}
            />
          </LabelBlock>
          <LabelBlock label="Continued Use">
            Your continued use of the Platform after the effective date of any changes constitutes your
            acceptance of the revised Privacy Policy. If you do not agree with the changes, you should
            discontinue use of the Platform and may request deletion of your account.
          </LabelBlock>
          <LabelBlock label="Material Changes">
            <p className="mb-2">Changes will be considered &ldquo;material&rdquo; if they:</p>
            <BulletList
              items={[
                "Significantly expand our collection or use of personal information",
                "Change the purposes for which we use information",
                "Substantially alter how we share information with third parties",
                "Reduce your rights or protections under the policy",
              ]}
            />
          </LabelBlock>

          {/* ─── 14. GDPR ─── */}
          <SectionHeading id="gdpr" number="14" title="Legal Basis for Processing (GDPR Compliance)" />
          <P>
            For users in the European Union, United Kingdom, and other jurisdictions with similar
            requirements, we process your personal information based on the following legal grounds:
          </P>
          <LabelBlock label="Contract Performance">
            Processing is necessary to perform our contract with you (e.g., providing Platform
            services, processing subscriptions, unlocking lawyer profiles).
          </LabelBlock>
          <LabelBlock label="Legitimate Interests">
            Processing is necessary for our legitimate business interests (e.g., improving services,
            fraud prevention, analytics), provided these interests do not override your fundamental
            rights.
          </LabelBlock>
          <LabelBlock label="Legal Obligations">
            Processing is required to comply with legal or regulatory obligations (e.g., tax records,
            responding to legal requests).
          </LabelBlock>
          <LabelBlock label="Consent">
            In some cases, we process information based on your explicit consent. You may withdraw
            consent at any time, though this will not affect the lawfulness of processing before
            withdrawal.
          </LabelBlock>
          <LabelBlock label="Vital Interests">
            In rare cases, processing may be necessary to protect your vital interests or those of
            another person.
          </LabelBlock>

          {/* ─── 15. CCPA ─── */}
          <SectionHeading id="ccpa" number="15" title="California Privacy Rights (CCPA)" />
          <P>
            If you are a United States California resident, you have specific rights under the
            California Consumer Privacy Act (CCPA):
          </P>
          <LabelBlock label="Right to Know">
            You can request information about the personal information we have collected about you in
            the past 12 months, including categories of information, sources, purposes, and third
            parties with whom we share it.
          </LabelBlock>
          <LabelBlock label="Right to Delete">
            You can request deletion of your personal information, subject to certain exceptions.
          </LabelBlock>
          <LabelBlock label="Right to Opt-Out">
            We do not &ldquo;sell&rdquo; personal information as defined by the CCPA. If this
            changes, we will provide an opt-out mechanism.
          </LabelBlock>
          <LabelBlock label="Right to Non-Discrimination">
            We will not discriminate against you for exercising your CCPA rights.
          </LabelBlock>
          <LabelBlock label="How to Exercise">
            Contact us at{" "}
            <a href="mailto:it@yamalealliance.org" className="font-medium underline" style={{ color: BRAND.gradientEnd }}>
              it@yamalealliance.org
            </a>{" "}
            with &ldquo;California Privacy Rights&rdquo; in the subject line. We will verify your
            identity before processing your request.
          </LabelBlock>
          <LabelBlock label="Authorized Agents">
            You may designate an authorized agent to make requests on your behalf. The agent must
            provide proof of authorization.
          </LabelBlock>

          {/* ─── 16. Automated Decision-Making ─── */}
          <SectionHeading id="automated" number="16" title="Automated Decision-Making and Profiling" />
          <P>
            We use automated systems, including AI, to enhance your experience on the Platform. This
            includes:
          </P>
          <BulletList
            items={[
              "AI-powered legal research and document analysis",
              "Personalized content recommendations",
              "Fraud detection and security monitoring",
              "Usage pattern analysis",
            ]}
          />
          <LabelBlock label="Lawyer Directory">
            We do not use automated decision-making to evaluate or score individual lawyers in our
            directory. Ratings are based on user reviews, and profile display is based on user search
            criteria (location, expertise, language).
          </LabelBlock>
          <LabelBlock label="Your Rights">
            <p className="mb-2">
              If you are subject to automated decision-making that produces legal effects or similarly
              significant effects, you have the right to:
            </p>
            <BulletList items={["Obtain human intervention", "Express your point of view", "Contest the decision"]} />
            <p>
              Contact us at{" "}
              <a href="mailto:it@yamalealliance.org" className="font-medium underline" style={{ color: BRAND.gradientEnd }}>
                it@yamalealliance.org
              </a>{" "}
              if you have concerns about automated processing.
            </p>
          </LabelBlock>

          {/* ─── 17. Acceptance ─── */}
          <SectionHeading id="acceptance" number="17" title="Acceptance of This Policy" />
          <P>
            By accessing or using the Yamalé Legal Platform, you acknowledge that you have read,
            understood, and agree to be bound by this Privacy Policy. This policy is effective as of
            the &ldquo;Last Updated&rdquo; date shown at the top of this document.
          </P>
          <P>
            If you do not agree with this Privacy Policy, you must not access or use our Platform.
          </P>
          <div
            className="mt-8 rounded-lg px-5 py-4 text-center text-sm"
            style={{ backgroundColor: "rgba(227,186,101,0.1)", color: BRAND.medium }}
          >
            This Privacy Policy was last updated on <strong>February 12, 2026</strong>. For questions
            or concerns, contact:{" "}
            <a href="mailto:it@yamalealliance.org" className="font-semibold underline" style={{ color: BRAND.gradientEnd }}>
              it@yamalealliance.org
            </a>
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          <Link href="/terms" className="font-medium hover:underline" style={{ color: BRAND.gradientEnd }}>
            Terms of Service
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
