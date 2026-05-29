import {
  PolicyBulletList,
  PolicyCallout,
  PolicyFooterNav,
  PolicyHero,
  PolicyLabelBlock,
  PolicyMailLink,
  PolicyP,
  PolicySectionHeading,
  PolicySubHeading,
  PolicyUpdatedBanner,
} from "@/components/legal/policy-document-primitives";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "Privacy Policy",
  description:
    "How Yamalé Legal Platform collects, uses, stores, and protects your personal data across our African legal research services.",
  path: "/privacy",
});

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <PolicyHero
        title="Privacy Policy"
        subtitle="How Yamalé collects, uses, and protects your data"
        dateLine="Last updated: February 12, 2026"
      />

      {/* Body */}
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-xl bg-white dark:bg-card shadow-md border border-border p-8 sm:p-10">
          {/* ─── 1. Introduction ─── */}
          <PolicySectionHeading id="introduction" number="1" title="Introduction" />
          <PolicyP>
            Yamalé Legal Platform (&ldquo;Yamalé&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
            &ldquo;our&rdquo;) operates the Yamalé Legal Platform website and mobile applications
            (collectively, the &ldquo;Platform&rdquo;), which provide African legal research, AfCFTA
            compliance tools, AI-powered legal research, a comprehensive legal document library, a
            verified lawyer directory, and The Yamale Vault for legal and compliance resources.
          </PolicyP>
          <PolicyP>
            This Privacy Policy explains how we collect, use, disclose, and safeguard your personal
            information when you use our Platform and services. We are committed to protecting your
            privacy and handling your data transparently and responsibly.
          </PolicyP>
          <PolicyP>
            By accessing or using the Platform, you acknowledge that you have read, understood, and
            agree to be bound by this Privacy Policy. If you do not agree with any part of this
            policy, please do not use our services.
          </PolicyP>

          {/* ─── 2. Information We Collect ─── */}
          <PolicySectionHeading id="info-collect" number="2" title="Information We Collect" />
          <PolicyP>We collect various types of information to provide and improve our services:</PolicyP>

          <PolicySubHeading number="2.1" title="Account and Identity Information" />
          <PolicyP>When you create an account, we collect:</PolicyP>
          <PolicyBulletList
            items={[
              "Full name",
              "Email address",
              "Password (encrypted)",
              "Account preferences and settings",
              "Subscription tier and billing information",
              "Authentication data provided through our authentication service provider",
            ]}
          />

          <PolicySubHeading number="2.2" title="Lawyer Profile Information (For Legal Professionals)" />
          <PolicyP>If you register as a lawyer in our directory, we collect and store:</PolicyP>
          <PolicyBulletList
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
          <PolicyCallout label="Important">
            Your contact information (email, phone, office address) and full law firm name are{" "}
            <strong>hidden</strong> from other users by default. This information is only revealed to
            users who pay to unlock your profile. Your practice areas, location, experience,
            languages, and other professional details remain visible to help users find the right
            lawyer for their needs.
          </PolicyCallout>

          <PolicySubHeading number="2.3" title="Usage and Activity Information" />
          <PolicyP>We automatically collect information about how you interact with our Platform:</PolicyP>
          <PolicyBulletList
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

          <PolicySubHeading number="2.4" title="Payment and Transaction Information" />
          <PolicyP>
            We process payments through secure third-party payment processors (such as pawaPay). We do{" "}
            <strong>NOT</strong> store your complete credit card information on our servers. We
            collect and store:
          </PolicyP>
          <PolicyBulletList
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
          <PolicyP>
            Our payment processors collect and process full payment card details in compliance with
            PCI DSS standards.
          </PolicyP>

          <PolicySubHeading number="2.5" title="Communications and Correspondence" />
          <PolicyP>If you contact us for support or inquiries:</PolicyP>
          <PolicyBulletList
            items={[
              "Email correspondence with our support team (it@yamalealliance.org)",
              "Customer support tickets and chat messages",
              "Feedback and survey responses",
              "Messages sent through the Platform",
            ]}
          />

          <PolicySubHeading number="2.6" title="The Yamale Vault Activity" />
          <PolicyP>When you use The Yamale Vault for legal resources:</PolicyP>
          <PolicyBulletList
            items={[
              "Purchase history of templates, courses, and toolkits",
              "Downloaded resources",
              "Reviews and ratings you provide",
              "Seller information (if you list products)",
            ]}
          />

          {/* ─── 3. How We Use Your Information ─── */}
          <PolicySectionHeading id="how-use" number="3" title="How We Use Your Information" />
          <PolicyP>We use the information we collect for the following purposes:</PolicyP>

          <PolicySubHeading number="3.1" title="To Provide and Maintain Our Services" />
          <PolicyBulletList
            items={[
              "Authenticate your identity and manage your account",
              "Process and fulfill your subscription",
              "Provide access to legal documents, research tools, and AI features",
              "Generate AfCFTA compliance reports",
              "Display lawyer profiles in our directory (with appropriate privacy controls)",
              "Process lawyer profile unlock payments and reveal contact information to paying users",
              "Facilitate The Yamale Vault transactions",
              "Track usage limits according to your subscription tier",
              "Enable document downloads and exports",
            ]}
          />

          <PolicySubHeading number="3.2" title="To Process Payments and Enforce Subscription Rules" />
          <PolicyBulletList
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

          <PolicySubHeading number="3.3" title="To Operate the Lawyer Directory" />
          <PolicyBulletList
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

          <PolicySubHeading number="3.4" title="To Improve and Personalize Our Platform" />
          <PolicyBulletList
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

          <PolicySubHeading number="3.5" title="To Communicate with You" />
          <PolicyBulletList
            items={[
              "Send transactional emails (account creation, password resets, purchase confirmations)",
              "Provide customer support and respond to inquiries",
              "Send subscription renewal reminders",
              "Notify you of Platform updates and new features (with option to opt out)",
              "Send legal and compliance notices",
              "Conduct user surveys (optional participation)",
            ]}
          />

          <PolicySubHeading number="3.6" title="For Legal Compliance and Security" />
          <PolicyBulletList
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
          <PolicySectionHeading id="sharing" number="4" title="How We Share Your Information" />
          <PolicyP>
            We may share your information with third parties in the following circumstances:
          </PolicyP>

          <PolicySubHeading number="4.1" title="Service Providers and Business Partners" />
          <PolicyP>
            We share information with trusted third-party service providers who help us operate the
            Platform:
          </PolicyP>
          <PolicyBulletList
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
          <PolicyP>
            These service providers are contractually obligated to protect your information and use it
            only for the specific services they provide to us. They cannot use your data for their own
            purposes.
          </PolicyP>

          <PolicySubHeading number="4.2" title="Other Platform Users (Lawyer Directory)" />
          <PolicyP>If you are a registered lawyer:</PolicyP>
          <PolicyLabelBlock label="Publicly visible information (shown to all users)">
            <PolicyBulletList
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
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Hidden information (only revealed after payment)">
            <PolicyBulletList
              items={[
                "Your full first and last name",
                "Complete law firm name",
                "Email address",
                "Phone number",
                "Office address",
              ]}
            />
          </PolicyLabelBlock>
          <PolicyP>
            When a user pays to unlock your profile, they receive permanent access to your contact
            information. We notify you when your profile is unlocked and provide the unlocking
            user&apos;s name and email so you can expect their contact.
          </PolicyP>
          <PolicyP>
            Users who unlock your profile may contact you directly outside the Platform. We are not
            responsible for how they use your contact information after it is revealed.
          </PolicyP>

          <PolicySubHeading number="4.3" title="Legal Requirements and Protection of Rights" />
          <PolicyP>
            We may disclose your information when required by law or when necessary to:
          </PolicyP>
          <PolicyBulletList
            items={[
              "Comply with court orders, subpoenas, or legal processes",
              "Respond to requests from government authorities or law enforcement",
              "Enforce our Terms of Service, policies, or user agreements",
              "Protect the rights, property, or safety of Yamalé, our users, or others",
              "Investigate and prevent fraud, security breaches, or illegal activities",
              "Defend against legal claims or litigation",
            ]}
          />

          <PolicySubHeading number="4.4" title="Business Transfers" />
          <PolicyP>
            If Yamalé is involved in a merger, acquisition, sale of assets, bankruptcy, or similar
            business transaction, your information may be transferred to the acquiring entity. We will
            notify you of any such change and provide information about your choices regarding your
            data.
          </PolicyP>

          <PolicySubHeading number="4.5" title="With Your Consent" />
          <PolicyP>
            We may share your information for other purposes with your explicit consent or at your
            direction.
          </PolicyP>

          {/* ─── 5. Data Retention ─── */}
          <PolicySectionHeading id="retention" number="5" title="Data Retention" />
          <PolicyP>
            We retain your personal information for as long as necessary to fulfill the purposes
            outlined in this Privacy Policy, unless a longer retention period is required or
            permitted by law.
          </PolicyP>
          <PolicyLabelBlock label="Active Accounts">
            We retain your account information and usage data while your account is active.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Lawyer Profiles">
            Lawyer profile information is retained as long as you maintain your listing in the
            directory. Verification documents are retained for regulatory compliance.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Transaction Records">
            Payment and transaction records are retained for at least 7 years for tax, accounting,
            and legal compliance purposes.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Unlocked Contacts">
            Records of lawyer profile unlocks are retained indefinitely to prevent duplicate charges
            and maintain service history.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="After Account Deletion">
            <p className="mb-2">
              When you delete your account, we will delete or anonymize your personal information
              within 90 days, except for information we are required to retain for legal, tax, audit,
              or security purposes. This includes:
            </p>
            <PolicyBulletList
              items={[
                "Transaction records (7 years)",
                "Legal compliance documents",
                "Anonymized usage data for analytics",
                "Information necessary to prevent fraud or enforce our Terms",
              ]}
            />
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Lawyer Profile Deletion">
            If you are a lawyer and request profile deletion, contact information revealed to users
            who previously unlocked your profile will remain with those users, as the transaction was
            completed. We will remove your profile from active search results within 30 days.
          </PolicyLabelBlock>

          {/* ─── 6. Data Security ─── */}
          <PolicySectionHeading id="security" number="6" title="Data Security" />
          <PolicyP>
            We implement appropriate technical, administrative, and physical security measures to
            protect your personal information from unauthorized access, disclosure, alteration, and
            destruction.
          </PolicyP>
          <PolicyLabelBlock label="Technical Safeguards">
            <PolicyBulletList
              items={[
                "Encryption of data in transit (TLS/SSL) and at rest",
                "Secure authentication systems with password hashing",
                "Regular security audits and vulnerability assessments",
                "Firewall protection and intrusion detection systems",
                "Secure API access controls",
                "Regular software updates and security patches",
              ]}
            />
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Administrative Safeguards">
            <PolicyBulletList
              items={[
                "Employee training on data protection and privacy",
                "Access controls limiting who can view personal information",
                "Background checks for employees with data access",
                "Incident response procedures",
                "Regular policy reviews and updates",
              ]}
            />
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Physical Safeguards">
            <PolicyBulletList
              items={[
                "Secure data centers with restricted access",
                "Environmental controls and redundancy",
                "Secure disposal of physical records",
              ]}
            />
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Payment Security">
            We use PCI DSS-compliant payment processors. We do not store complete credit card
            numbers on our servers.
          </PolicyLabelBlock>
          <PolicyCallout label="Important Limitation">
            While we implement strong security measures, no system is 100% secure. You provide
            information at your own risk. We cannot guarantee absolute security, and we are not
            responsible for unauthorized access resulting from circumstances beyond our reasonable
            control.
          </PolicyCallout>
          <PolicyCallout label="Your Responsibility">
            You are responsible for maintaining the confidentiality of your account credentials.
            Never share your password, and notify us immediately if you suspect unauthorized account
            access.
          </PolicyCallout>

          {/* ─── 7. Your Rights and Choices ─── */}
          <PolicySectionHeading id="rights" number="7" title="Your Rights and Choices" />
          <PolicyP>
            Depending on your location and applicable data protection laws (including GDPR, CCPA, and
            African data protection regulations), you may have the following rights:
          </PolicyP>

          <PolicySubHeading number="7.1" title="Right to Access" />
          <PolicyP>
            You have the right to request access to the personal information we hold about you and
            receive a copy in a structured, commonly used format.
          </PolicyP>

          <PolicySubHeading number="7.2" title="Right to Correction" />
          <PolicyP>
            You can update most of your account information directly through your profile settings.
            For lawyer profiles, you can update your practice information, contact details, and other
            profile data. If you cannot update information yourself, contact us at{" "}
            <PolicyMailLink email="it@yamalealliance.org" />
            .
          </PolicyP>

          <PolicySubHeading number="7.3" title="Right to Deletion" />
          <PolicyP>
            You may request deletion of your personal information, subject to certain exceptions
            (e.g., legal obligations, fraud prevention, transaction records). To delete your account,
            contact us at{" "}
            <PolicyMailLink email="it@yamalealliance.org" />
            .
          </PolicyP>
          <PolicyCallout label="Note for Lawyers">
            If users have previously unlocked your profile, they will retain access to the contact
            information they paid for. We cannot retrieve information that has already been disclosed
            through a completed transaction.
          </PolicyCallout>

          <PolicySubHeading number="7.4" title="Right to Object and Restrict Processing" />
          <PolicyP>
            You may object to certain processing of your personal information or request that we
            restrict processing in certain circumstances, such as when you contest the accuracy of
            your data or the lawfulness of processing.
          </PolicyP>

          <PolicySubHeading number="7.5" title="Right to Data Portability" />
          <PolicyP>
            Where applicable, you have the right to receive your personal information in a portable
            format and transmit it to another service provider.
          </PolicyP>

          <PolicySubHeading number="7.6" title="Right to Withdraw Consent" />
          <PolicyP>
            Where we process your information based on consent, you have the right to withdraw that
            consent at any time. This will not affect the lawfulness of processing before withdrawal.
          </PolicyP>

          <PolicySubHeading number="7.7" title="Marketing Communications" />
          <PolicyP>
            You can opt out of marketing emails by clicking the &ldquo;unsubscribe&rdquo; link in any
            marketing email or by updating your communication preferences in your account settings.
            You will continue to receive transactional emails (e.g., receipts, password resets) even
            if you opt out of marketing.
          </PolicyP>

          <PolicySubHeading number="7.8" title="How to Exercise Your Rights" />
          <PolicyP>
            To exercise any of these rights, please contact us at{" "}
            <PolicyMailLink email="it@yamalealliance.org" />
            . We will respond to your request within the timeframe required by applicable law
            (typically 30 days). We may need to verify your identity before processing your request.
          </PolicyP>

          {/* ─── 8. Cookies ─── */}
          <PolicySectionHeading id="cookies" number="8" title="Cookies and Similar Technologies" />
          <PolicyP>
            We and our service providers use cookies, web beacons, and similar tracking technologies
            to:
          </PolicyP>
          <PolicyBulletList
            items={[
              "Authenticate users and maintain login sessions",
              "Remember your preferences and settings",
              "Analyze Platform usage and performance",
              "Provide security and detect fraud",
              "Deliver and measure the effectiveness of features",
            ]}
          />
          <PolicyLabelBlock label="Types of Cookies We Use">
            <PolicyBulletList
              items={[
                <span key="e"><strong>Essential Cookies:</strong> Required for the Platform to function (authentication, security, session management)</span>,
                <span key="f"><strong>Functional Cookies:</strong> Remember your preferences and settings</span>,
                <span key="a"><strong>Analytics Cookies:</strong> Help us understand how you use the Platform</span>,
                <span key="s"><strong>Security Cookies:</strong> Detect and prevent fraudulent activity</span>,
              ]}
            />
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Managing Cookies">
            Most web browsers accept cookies by default. You can adjust your browser settings to
            refuse cookies or alert you when cookies are being sent. However, some features of the
            Platform may not function properly if you disable cookies, particularly authentication and
            session management.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Third-Party Cookies">
            Some cookies may be set by our service providers (e.g., analytics tools). These third
            parties have their own privacy policies governing their use of your information.
          </PolicyLabelBlock>

          {/* ─── 9. Third-Party Links ─── */}
          <PolicySectionHeading id="third-party" number="9" title="Third-Party Links and Services" />
          <PolicyP>
            Our Platform may contain links to third-party websites, applications, or services
            (including resources in The Yamale Vault, external legal databases, or social media
            platforms). We are not responsible for the privacy practices or content of these third
            parties.
          </PolicyP>
          <PolicyP>
            When you click on a third-party link or access a third-party service, you leave our
            Platform and are subject to that third party&apos;s privacy policy and terms of service.
            We encourage you to read the privacy policies of any third-party services you visit.
          </PolicyP>
          <PolicyLabelBlock label="The Yamale Vault Resources">
            When you purchase templates, courses, or other resources from third-party sellers in The
            Yamale Vault, the seller may collect additional information from you. We facilitate the
            transaction but are not responsible for the seller&apos;s privacy practices.
          </PolicyLabelBlock>

          {/* ─── 10. International Data Transfers ─── */}
          <PolicySectionHeading id="transfers" number="10" title="International Data Transfers" />
          <PolicyP>
            Yamalé operates internationally and your information may be transferred to, stored in, and
            processed in countries other than your country of residence, including other countries in
            Africa, the United States, Europe, and other regions where our service providers operate.
          </PolicyP>
          <PolicyP>
            These countries may have data protection laws that differ from the laws of your country.
            When we transfer your personal information internationally, we implement appropriate
            safeguards to protect your data, including:
          </PolicyP>
          <PolicyBulletList
            items={[
              "Standard Contractual Clauses (SCCs) approved by relevant authorities",
              "Data processing agreements with service providers",
              "Adequacy decisions by relevant data protection authorities",
              "Other legally recognized transfer mechanisms",
            ]}
          />
          <PolicyP>
            Where required by law, we will obtain your consent before transferring your information
            internationally.
          </PolicyP>
          <PolicyCallout label="For African Users">
            We strive to store African user data within Africa or in jurisdictions with adequate data
            protection standards. However, some of our service providers (particularly AI and cloud
            infrastructure providers) may process data outside Africa. We ensure these providers
            comply with applicable data protection requirements.
          </PolicyCallout>

          {/* ─── 11. Children's Privacy ─── */}
          <PolicySectionHeading id="children" number="11" title="Children's Privacy" />
          <PolicyP>
            Our Platform is not intended for use by individuals under the age of 18 (or the minimum
            age of digital consent in your jurisdiction). We do not knowingly collect personal
            information from children.
          </PolicyP>
          <PolicyP>
            If you are a parent or guardian and believe your child has provided personal information to
            us, please contact us immediately at{" "}
            <PolicyMailLink email="it@yamalealliance.org" />
            . Upon verification, we will promptly delete such information from our systems.
          </PolicyP>

          {/* ─── 12. Contact ─── */}
          <PolicySectionHeading id="contact" number="12" title="Data Protection Officer and Contact Information" />
          <PolicyP>
            If you have questions, concerns, or requests regarding this Privacy Policy or our data
            practices, please contact us:
          </PolicyP>
          <div className="my-4 rounded-lg border border-border bg-gray-50 dark:bg-muted/30 p-5 space-y-2 text-[15px]">
            <p>
              <strong className="text-[#603b1c] dark:text-[#e3ba65]">Email:</strong>{" "}
              <PolicyMailLink email="it@yamalealliance.org" />
            </p>
            <p>
              <strong className="text-[#603b1c] dark:text-[#e3ba65]">Subject Line:</strong> Privacy Inquiry — [Your
              Topic]
            </p>
          </div>
          <PolicyLabelBlock label="Data Protection Officer">
            For GDPR or other data protection inquiries, you may request to speak with our Data
            Protection Officer by emailing{" "}
            <PolicyMailLink email="it@yamalealliance.org" />{" "}
            with the subject line &ldquo;Attention: DPO&rdquo;.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Response Time">
            We aim to respond to all privacy inquiries within 30 days. For complex requests, we may
            extend this period and will notify you of the extension.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Right to Lodge a Complaint">
            If you are located in the European Union, United Kingdom, or another jurisdiction with a
            data protection authority, you have the right to lodge a complaint with your local
            supervisory authority if you believe we have violated your data protection rights.
          </PolicyLabelBlock>

          {/* ─── 13. Changes ─── */}
          <PolicySectionHeading id="changes" number="13" title="Changes to This Privacy Policy" />
          <PolicyP>
            We may update this Privacy Policy from time to time to reflect changes in our practices,
            services, legal requirements, or for other operational, legal, or regulatory reasons.
          </PolicyP>
          <PolicyLabelBlock label="Notification of Changes">
            <p className="mb-2">When we make changes, we will:</p>
            <PolicyBulletList
              items={[
                'Update the "Last Updated" date at the top of this policy',
                "Post the revised policy on our Platform",
                "For material changes that significantly affect your rights, we will provide additional notice through email or a prominent notice on the Platform",
              ]}
            />
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Continued Use">
            Your continued use of the Platform after the effective date of any changes constitutes your
            acceptance of the revised Privacy Policy. If you do not agree with the changes, you should
            discontinue use of the Platform and may request deletion of your account.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Material Changes">
            <p className="mb-2">Changes will be considered &ldquo;material&rdquo; if they:</p>
            <PolicyBulletList
              items={[
                "Significantly expand our collection or use of personal information",
                "Change the purposes for which we use information",
                "Substantially alter how we share information with third parties",
                "Reduce your rights or protections under the policy",
              ]}
            />
          </PolicyLabelBlock>

          {/* ─── 14. GDPR ─── */}
          <PolicySectionHeading id="gdpr" number="14" title="Legal Basis for Processing (GDPR Compliance)" />
          <PolicyP>
            For users in the European Union, United Kingdom, and other jurisdictions with similar
            requirements, we process your personal information based on the following legal grounds:
          </PolicyP>
          <PolicyLabelBlock label="Contract Performance">
            Processing is necessary to perform our contract with you (e.g., providing Platform
            services, processing subscriptions, unlocking lawyer profiles).
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Legitimate Interests">
            Processing is necessary for our legitimate business interests (e.g., improving services,
            fraud prevention, analytics), provided these interests do not override your fundamental
            rights.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Legal Obligations">
            Processing is required to comply with legal or regulatory obligations (e.g., tax records,
            responding to legal requests).
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Consent">
            In some cases, we process information based on your explicit consent. You may withdraw
            consent at any time, though this will not affect the lawfulness of processing before
            withdrawal.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Vital Interests">
            In rare cases, processing may be necessary to protect your vital interests or those of
            another person.
          </PolicyLabelBlock>

          {/* ─── 15. CCPA ─── */}
          <PolicySectionHeading id="ccpa" number="15" title="California Privacy Rights (CCPA)" />
          <PolicyP>
            If you are a United States California resident, you have specific rights under the
            California Consumer Privacy Act (CCPA):
          </PolicyP>
          <PolicyLabelBlock label="Right to Know">
            You can request information about the personal information we have collected about you in
            the past 12 months, including categories of information, sources, purposes, and third
            parties with whom we share it.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Right to Delete">
            You can request deletion of your personal information, subject to certain exceptions.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Right to Opt-Out">
            We do not &ldquo;sell&rdquo; personal information as defined by the CCPA. If this
            changes, we will provide an opt-out mechanism.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Right to Non-Discrimination">
            We will not discriminate against you for exercising your CCPA rights.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="How to Exercise">
            Contact us at{" "}
            <PolicyMailLink email="it@yamalealliance.org" />{" "}
            with &ldquo;California Privacy Rights&rdquo; in the subject line. We will verify your
            identity before processing your request.
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Authorized Agents">
            You may designate an authorized agent to make requests on your behalf. The agent must
            provide proof of authorization.
          </PolicyLabelBlock>

          {/* ─── 16. Automated Decision-Making ─── */}
          <PolicySectionHeading id="automated" number="16" title="Automated Decision-Making and Profiling" />
          <PolicyP>
            We use automated systems, including AI, to enhance your experience on the Platform. This
            includes:
          </PolicyP>
          <PolicyBulletList
            items={[
              "AI-powered legal research and document analysis",
              "Personalized content recommendations",
              "Fraud detection and security monitoring",
              "Usage pattern analysis",
            ]}
          />
          <PolicyLabelBlock label="Lawyer Directory">
            We do not use automated decision-making to evaluate or score individual lawyers in our
            directory. Ratings are based on user reviews, and profile display is based on user search
            criteria (location, expertise, language).
          </PolicyLabelBlock>
          <PolicyLabelBlock label="Your Rights">
            <p className="mb-2">
              If you are subject to automated decision-making that produces legal effects or similarly
              significant effects, you have the right to:
            </p>
            <PolicyBulletList items={["Obtain human intervention", "Express your point of view", "Contest the decision"]} />
            <p>
              Contact us at{" "}
              <PolicyMailLink email="it@yamalealliance.org" />{" "}
              if you have concerns about automated processing.
            </p>
          </PolicyLabelBlock>

          {/* ─── 17. Acceptance ─── */}
          <PolicySectionHeading id="acceptance" number="17" title="Acceptance of This Policy" />
          <PolicyP>
            By accessing or using the Yamalé Legal Platform, you acknowledge that you have read,
            understood, and agree to be bound by this Privacy Policy. This policy is effective as of
            the &ldquo;Last Updated&rdquo; date shown at the top of this document.
          </PolicyP>
          <PolicyP>
            If you do not agree with this Privacy Policy, you must not access or use our Platform.
          </PolicyP>
          <PolicyUpdatedBanner>
            This Privacy Policy was last updated on <strong>February 12, 2026</strong>. For questions or concerns,
            contact: <PolicyMailLink email="it@yamalealliance.org" />
          </PolicyUpdatedBanner>
        </div>

        <PolicyFooterNav
          links={[
            { href: "/terms", label: "Terms of Service" },
            { href: "/payment-refund", label: "Payment & Refund Policy" },
            { href: "/", label: "Home" },
          ]}
        />
      </div>
    </div>
  );
}
