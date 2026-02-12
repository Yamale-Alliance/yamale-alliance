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
          Last updated: 12 February 2026
        </p>

        <pre className="mt-10 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
{`PRIVACY POLICY

Last Updated: February 12, 2026

1. Introduction
Yamalé Legal Platform ("Yamalé", "we", "us", or "our") operates the Yamalé Legal Platform website and
mobile applications (collectively, the "Platform"), which provide African legal research, AfCFTA compliance
tools, AI-powered legal research, a comprehensive legal document library, a verified lawyer directory, and
a marketplace for legal and compliance resources.
This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when
you use our Platform and services. We are committed to protecting your privacy and handling your data
transparently and responsibly.
By accessing or using the Platform, you acknowledge that you have read, understood, and agree to be
bound by this Privacy Policy. If you do not agree with any part of this policy, please do not use our services.

2. Information We Collect
We collect various types of information to provide and improve our services:

2.1 Account and Identity Information
When you create an account, we collect:
• Full name
• Email address
• Password (encrypted)
• Account preferences and settings
• Subscription tier and billing information
• Authentication data provided through our authentication service provider

2.2 Lawyer Profile Information (For Legal Professionals)
If you register as a lawyer in our directory, we collect and store:
• Professional information: Full name, law firm name, title/position, practice areas, years of experience, bar
admission details
• Contact information: Business email address, phone number, office address
• Geographic information: Country, city, and regions where you practice
• Languages spoken
• Educational background and qualifications
• Profile picture (optional)
• Professional pronouns (optional)
• Verification documents: Bar certificates, licenses, degrees, and other credentials (stored securely and
used only for verification purposes)
• Rating and review data from platform users

IMPORTANT: Your contact information (email, phone, office address) and full law firm name are HIDDEN
from other users by default. This information is only revealed to users who pay to unlock your profile. Your
practice areas, location, experience, languages, and other professional details remain visible to help users
find the right lawyer for their needs.

2.3 Usage and Activity Information
We automatically collect information about how you interact with our Platform:
• Pages viewed and documents accessed
• Search queries and filters used
• AI research queries and conversations
• Document downloads and exports
• AfCFTA reports generated
• Lawyer directory searches and filters applied
• Lawyer profiles unlocked (including payment information)
• Day pass purchases and usage
• Feature usage statistics (e.g., number of AI queries, documents saved)
• Time spent on the Platform
• Device information: IP address, browser type, operating system, device identifiers
• Log data: Access times, errors, and system activity

2.4 Payment and Transaction Information
We process payments through secure third-party payment processors (such as Stripe). We do NOT store
your complete credit card information on our servers. We collect and store:
• Subscription tier and status
• Transaction history and receipts
• Lawyer profile unlock purchases
• Day pass purchases
• Pay-as-you-go usage records
• Billing address
• Payment method type (last 4 digits only)
• Mobile money transaction references (where applicable)
Our payment processors collect and process full payment card details in compliance with PCI DSS
standards.

2.5 Communications and Correspondence
If you contact us for support or inquiries:
• Email correspondence with our support team (it@yamalealliance.org)
• Customer support tickets and chat messages
• Feedback and survey responses
• Messages sent through the Platform

2.6 Marketplace Activity
When you use our marketplace for legal resources:
• Purchase history of templates, courses, and toolkits
• Downloaded resources
• Reviews and ratings you provide
• Seller information (if you list products)

3. How We Use Your Information
We use the information we collect for the following purposes:

3.1 To Provide and Maintain Our Services
• Authenticate your identity and manage your account
• Process and fulfill your subscription
• Provide access to legal documents, research tools, and AI features
• Generate AfCFTA compliance reports
• Display lawyer profiles in our directory (with appropriate privacy controls)
• Process lawyer profile unlock payments and reveal contact information to paying users
• Facilitate marketplace transactions
• Track usage limits according to your subscription tier
• Enable document downloads and exports

3.2 To Process Payments and Enforce Subscription Rules
• Process monthly or annual subscription payments
• Process one-time payments for lawyer contact unlocks
• Process day pass purchases ($9.99 for 24-hour access)
• Process pay-as-you-go charges (documents, AI queries, reports)
• Manage billing disputes and refunds
• Enforce usage limits and tier restrictions
• Prevent payment fraud

3.3 To Operate the Lawyer Directory
• Display lawyer profiles to users searching for legal professionals
• Show public information: initials (before unlock), title, practice areas, location, experience, languages,
education, bar admission, ratings
• HIDE sensitive information until payment: full name, law firm name, email, phone, office address
• Verify lawyer credentials and maintain directory quality
• Enable search and filtering by location, expertise, and language
• Facilitate connections between users and legal professionals after payment
• Track which users have unlocked which lawyer profiles

3.4 To Improve and Personalize Our Platform
• Analyze usage patterns and trends
• Develop new features and services
• Enhance AI research capabilities
• Improve search and discovery
• Personalize content recommendations
• Optimize Platform performance
• Conduct internal research and analytics

3.5 To Communicate with You
• Send transactional emails (account creation, password resets, purchase confirmations)
• Provide customer support and respond to inquiries
• Send subscription renewal reminders
• Notify you of Platform updates and new features (with option to opt out)
• Send legal and compliance notices
• Conduct user surveys (optional participation)

3.6 For Legal Compliance and Security
• Comply with legal obligations and regulatory requirements
• Enforce our Terms of Service and other policies
• Protect against fraud, abuse, and unauthorized access
• Resolve disputes and prevent illegal activities
• Protect the rights, property, and safety of Yamalé, our users, and the public
• Respond to legal requests from authorities

4. How We Share Your Information
We may share your information with third parties in the following circumstances:

4.1 Service Providers and Business Partners
We share information with trusted third-party service providers who help us operate the Platform:
• Authentication services (e.g., Clerk, Auth0) - to manage user accounts and login
• Database and storage providers (e.g., Supabase, AWS) - to store Platform data and documents
• Payment processors (e.g., Stripe, mobile money providers) - to process subscription and unlock payments
• AI providers (e.g., Anthropic Claude) - to power our AI legal research features
• Email service providers - to send transactional and notification emails
• Analytics providers - to understand Platform usage and performance
• Cloud infrastructure providers - to host and operate the Platform
• Customer support tools - to provide assistance

These service providers are contractually obligated to protect your information and use it only for the
specific services they provide to us. They cannot use your data for their own purposes.

4.2 Other Platform Users (Lawyer Directory)
If you are a registered lawyer:

PUBLICLY VISIBLE INFORMATION (shown to all users searching the directory):
• Your initials (e.g., "C. A." instead of full name)
• Professional title (e.g., "Senior Partner")
• Practice areas and expertise
• City and country
• Years of experience
• Languages spoken
• Bar admission year
• Educational background
• Star rating and number of reviews
• Verification badge status

HIDDEN INFORMATION (only revealed after payment):
• Your full first and last name
• Complete law firm name
• Email address
• Phone number
• Office address

When a user pays to unlock your profile, they receive permanent access to your contact information. We
notify you when your profile is unlocked and provide the unlocking user's name and email so you can
expect their contact.
Users who unlock your profile may contact you directly outside the Platform. We are not responsible for
how they use your contact information after it is revealed.

4.3 Legal Requirements and Protection of Rights
We may disclose your information when required by law or when necessary to:
• Comply with court orders, subpoenas, or legal processes
• Respond to requests from government authorities or law enforcement
• Enforce our Terms of Service, policies, or user agreements
• Protect the rights, property, or safety of Yamalé, our users, or others
• Investigate and prevent fraud, security breaches, or illegal activities
• Defend against legal claims or litigation

4.4 Business Transfers
If Yamalé is involved in a merger, acquisition, sale of assets, bankruptcy, or similar business transaction,
your information may be transferred to the acquiring entity. We will notify you of any such change and
provide information about your choices regarding your data.

4.5 With Your Consent
We may share your information for other purposes with your explicit consent or at your direction.

5. Data Retention
We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy
Policy, unless a longer retention period is required or permitted by law.

ACTIVE ACCOUNTS: We retain your account information and usage data while your account is active.

LAWYER PROFILES: Lawyer profile information is retained as long as you maintain your listing in the
directory. Verification documents are retained for regulatory compliance.

TRANSACTION RECORDS: Payment and transaction records are retained for at least 7 years for tax,
accounting, and legal compliance purposes.

UNLOCKED CONTACTS: Records of lawyer profile unlocks are retained indefinitely to prevent duplicate
charges and maintain service history.

AFTER ACCOUNT DELETION: When you delete your account, we will delete or anonymize your personal
information within 90 days, except for information we are required to retain for legal, tax, audit, or security
purposes. This includes:
• Transaction records (7 years)
• Legal compliance documents
• Anonymized usage data for analytics
• Information necessary to prevent fraud or enforce our Terms

LAWYER PROFILE DELETION: If you are a lawyer and request profile deletion, contact information
revealed to users who previously unlocked your profile will remain with those users, as the transaction
was completed. We will remove your profile from active search results within 30 days.

6. Data Security
We implement appropriate technical, administrative, and physical security measures to protect your
personal information from unauthorized access, disclosure, alteration, and destruction. These measures
include:

TECHNICAL SAFEGUARDS:
• Encryption of data in transit (TLS/SSL) and at rest
• Secure authentication systems with password hashing
• Regular security audits and vulnerability assessments
• Firewall protection and intrusion detection systems
• Secure API access controls
• Regular software updates and security patches

ADMINISTRATIVE SAFEGUARDS:
• Employee training on data protection and privacy
• Access controls limiting who can view personal information
• Background checks for employees with data access
• Incident response procedures
• Regular policy reviews and updates

PHYSICAL SAFEGUARDS:
• Secure data centers with restricted access
• Environmental controls and redundancy
• Secure disposal of physical records

PAYMENT SECURITY: We use PCI DSS-compliant payment processors. We do not store complete credit
card numbers on our servers.

IMPORTANT LIMITATION: While we implement strong security measures, no system is 100% secure. You
provide information at your own risk. We cannot guarantee absolute security, and we are not responsible
for unauthorized access resulting from circumstances beyond our reasonable control.

YOUR RESPONSIBILITY: You are responsible for maintaining the confidentiality of your account
credentials. Never share your password, and notify us immediately if you suspect unauthorized account
access.

7. Your Rights and Choices
Depending on your location and applicable data protection laws (including GDPR, CCPA, and African data
protection regulations), you may have the following rights:

7.1 Right to Access
You have the right to request access to the personal information we hold about you and receive a copy in a
structured, commonly used format.

7.2 Right to Correction
You can update most of your account information directly through your profile settings. For lawyer
profiles, you can update your practice information, contact details, and other profile data. If you cannot
update information yourself, contact us at it@yamalealliance.org.

7.3 Right to Deletion
You may request deletion of your personal information, subject to certain exceptions (e.g., legal obligations,
fraud prevention, transaction records). To delete your account, contact us at it@yamalealliance.org.

NOTE FOR LAWYERS: If users have previously unlocked your profile, they will retain access to the contact
information they paid for. We cannot retrieve information that has already been disclosed through a
completed transaction.

7.4 Right to Object and Restrict Processing
You may object to certain processing of your personal information or request that we restrict processing in
certain circumstances, such as when you contest the accuracy of your data or the lawfulness of processing.

7.5 Right to Data Portability
Where applicable, you have the right to receive your personal information in a portable format and
transmit it to another service provider.

7.6 Right to Withdraw Consent
Where we process your information based on consent, you have the right to withdraw that consent at any
time. This will not affect the lawfulness of processing before withdrawal.

7.7 Marketing Communications
You can opt out of marketing emails by clicking the "unsubscribe" link in any marketing email or by
updating your communication preferences in your account settings. You will continue to receive
transactional emails (e.g., receipts, password resets) even if you opt out of marketing.

7.8 How to Exercise Your Rights
To exercise any of these rights, please contact us at it@yamalealliance.org. We will respond to your request
within the timeframe required by applicable law (typically 30 days). We may need to verify your identity
before processing your request.

8. Cookies and Similar Technologies
We and our service providers use cookies, web beacons, and similar tracking technologies to:
• Authenticate users and maintain login sessions
• Remember your preferences and settings
• Analyze Platform usage and performance
• Provide security and detect fraud
• Deliver and measure the effectiveness of features

TYPES OF COOKIES WE USE:
• ESSENTIAL COOKIES: Required for the Platform to function (authentication, security, session
management)
• FUNCTIONAL COOKIES: Remember your preferences and settings
• ANALYTICS COOKIES: Help us understand how you use the Platform
• SECURITY COOKIES: Detect and prevent fraudulent activity

MANAGING COOKIES: Most web browsers accept cookies by default. You can adjust your browser settings
to refuse cookies or alert you when cookies are being sent. However, some features of the Platform may not
function properly if you disable cookies, particularly authentication and session management.

THIRD-PARTY COOKIES: Some cookies may be set by our service providers (e.g., analytics tools). These
third parties have their own privacy policies governing their use of your information.

9. Third-Party Links and Services
Our Platform may contain links to third-party websites, applications, or services (including resources in
our marketplace, external legal databases, or social media platforms). We are not responsible for the
privacy practices or content of these third parties.

When you click on a third-party link or access a third-party service, you leave our Platform and are subject
to that third party's privacy policy and terms of service. We encourage you to read the privacy policies of
any third-party services you visit.

MARKETPLACE RESOURCES: When you purchase templates, courses, or other resources from third-party
sellers in our marketplace, the seller may collect additional information from you. We facilitate the
transaction but are not responsible for the seller's privacy practices.

10. International Data Transfers
Yamalé operates internationally and your information may be transferred to, stored in, and processed in
countries other than your country of residence, including other countries in Africa, the United States,
Europe, and other regions where our service providers operate.

These countries may have data protection laws that differ from the laws of your country. When we transfer
your personal information internationally, we implement appropriate safeguards to protect your data,
including:
• Standard Contractual Clauses (SCCs) approved by relevant authorities
• Data processing agreements with service providers
• Adequacy decisions by relevant data protection authorities
• Other legally recognized transfer mechanisms

Where required by law, we will obtain your consent before transferring your information internationally.

FOR AFRICAN USERS: We strive to store African user data within Africa or in jurisdictions with adequate
data protection standards. However, some of our service providers (particularly AI and cloud
infrastructure providers) may process data outside Africa. We ensure these providers comply with
applicable data protection requirements.

11. Children's Privacy
Our Platform is not intended for use by individuals under the age of 18 (or the minimum age of digital
consent in your jurisdiction). We do not knowingly collect personal information from children.

If you are a parent or guardian and believe your child has provided personal information to us, please
contact us immediately at it@yamalealliance.org. Upon verification, we will promptly delete such
information from our systems.

If we discover that we have inadvertently collected information from a child, we will take immediate steps
to delete it.

12. Data Protection Officer and Contact Information
If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please
contact us:

EMAIL: it@yamalealliance.org
SUBJECT LINE: Privacy Inquiry - [Your Topic]

DATA PROTECTION OFFICER: For GDPR or other data protection inquiries, you may request to speak with
our Data Protection Officer by emailing it@yamalealliance.org with the subject line "Attention: DPO".

RESPONSE TIME: We aim to respond to all privacy inquiries within 30 days. For complex requests, we may
extend this period and will notify you of the extension.

RIGHT TO LODGE A COMPLAINT: If you are located in the European Union, United Kingdom, or another
jurisdiction with a data protection authority, you have the right to lodge a complaint with your local
supervisory authority if you believe we have violated your data protection rights.

13. Changes to This Privacy Policy
We may update this Privacy Policy from time to time to reflect changes in our practices, services, legal
requirements, or for other operational, legal, or regulatory reasons.

NOTIFICATION OF CHANGES: When we make changes, we will:
• Update the "Last Updated" date at the top of this policy
• Post the revised policy on our Platform
• For material changes that significantly affect your rights, we will provide additional notice through email
or a prominent notice on the Platform

CONTINUED USE: Your continued use of the Platform after the effective date of any changes constitutes
your acceptance of the revised Privacy Policy. If you do not agree with the changes, you should discontinue
use of the Platform and may request deletion of your account.

MATERIAL CHANGES: Changes will be considered "material" if they:
• Significantly expand our collection or use of personal information
• Change the purposes for which we use information
• Substantially alter how we share information with third parties
• Reduce your rights or protections under the policy

We encourage you to review this Privacy Policy periodically to stay informed about how we protect your
information.

14. Legal Basis for Processing (GDPR Compliance)
For users in the European Union, United Kingdom, and other jurisdictions with similar requirements, we
process your personal information based on the following legal grounds:

CONTRACT PERFORMANCE: Processing is necessary to perform our contract with you (e.g., providing
Platform services, processing subscriptions, unlocking lawyer profiles).

LEGITIMATE INTERESTS: Processing is necessary for our legitimate business interests (e.g., improving
services, fraud prevention, analytics), provided these interests do not override your fundamental rights.

LEGAL OBLIGATIONS: Processing is required to comply with legal or regulatory obligations (e.g., tax
records, responding to legal requests).

CONSENT: In some cases, we process information based on your explicit consent. You may withdraw
consent at any time, though this will not affect the lawfulness of processing before withdrawal.

VITAL INTERESTS: In rare cases, processing may be necessary to protect your vital interests or those of
another person.

15. California Privacy Rights (CCPA)
If you are a United States California resident, you have specific rights under the California Consumer
Privacy Act (CCPA):

RIGHT TO KNOW: You can request information about the personal information we have collected about
you in the past 12 months, including categories of information, sources, purposes, and third parties with
whom we share it.

RIGHT TO DELETE: You can request deletion of your personal information, subject to certain exceptions.

RIGHT TO OPT-OUT: We do not "sell" personal information as defined by the CCPA. If this changes, we will
provide an opt-out mechanism.

RIGHT TO NON-DISCRIMINATION: We will not discriminate against you for exercising your CCPA rights.

HOW TO EXERCISE: Contact us at it@yamalealliance.org with "California Privacy Rights" in the subject line.
We will verify your identity before processing your request.

AUTHORIZED AGENTS: You may designate an authorized agent to make requests on your behalf. The agent
must provide proof of authorization.

16. Automated Decision-Making and Profiling
We use automated systems, including AI, to enhance your experience on the Platform. This includes:
• AI-powered legal research and document analysis
• Personalized content recommendations
• Fraud detection and security monitoring
• Usage pattern analysis

LAWYER DIRECTORY: We do not use automated decision-making to evaluate or score individual lawyers in
our directory. Ratings are based on user reviews, and profile display is based on user search criteria
(location, expertise, language).

YOUR RIGHTS: If you are subject to automated decision-making that produces legal effects or similarly
significant effects, you have the right to:
• Obtain human intervention
• Express your point of view
• Contest the decision

Contact us at it@yamalealliance.org if you have concerns about automated processing.

17. Acceptance of This Policy
By accessing or using the Yamalé Legal Platform, you acknowledge that you have read, understood, and
agree to be bound by this Privacy Policy. This policy is effective as of the "Last Updated" date shown at the
top of this document.

If you do not agree with this Privacy Policy, you must not access or use our Platform.

This Privacy Policy was last updated on February 12, 2026. For questions or concerns, contact: it@yamalealliance.org.`}
        </pre>

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
