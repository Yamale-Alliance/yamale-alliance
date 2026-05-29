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
  PolicySubHeading,
  PolicyUpdatedBanner,
} from "@/components/legal/policy-document-primitives";

export const metadata: Metadata = {
  title: "Payment & Refund Policy | Yamalé Legal Platform",
  description:
    "Payment & Refund Policy for Yamalé Legal Platform — billing, accepted payment methods, cancellations, and refunds.",
};

const BILLING_EMAIL = "info@yamalealliance.org";

export default function PaymentRefundPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <PolicyHero
        title="Payment & Refund Policy"
        subtitle="Billing, accepted payment methods, and your rights when something goes wrong"
        dateLine="Effective date: May 2026 · Version 1.0"
      />

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-xl border border-border bg-white p-8 shadow-md dark:bg-card sm:p-10">
          <PolicySectionHeading id="introduction" number="1" title="Introduction" />
          <PolicyP>
            This Payment &amp; Refund Policy (&ldquo;Policy&rdquo;) governs all financial transactions on the
            Yamalé Legal Platform (&ldquo;Platform&rdquo;), operated by Yamalé, a legal entity established under
            the laws of Senegal and headquartered in Dakar, Senegal.
          </PolicyP>
          <PolicyP>
            By completing a purchase or subscribing to any paid feature on the Platform, you agree to the terms
            of this Policy. This Policy forms part of, and should be read together with, the{" "}
            <PolicyInlineLink href="/terms">Yamalé Terms of Service</PolicyInlineLink> and{" "}
            <PolicyInlineLink href="/privacy">Privacy Policy</PolicyInlineLink>
            .
          </PolicyP>
          <PolicyP>
            If you have questions about a charge or payment, contact us at <PolicyMailLink email={BILLING_EMAIL} /> before
            initiating a dispute or chargeback with your payment provider.
          </PolicyP>

          <PolicySectionHeading id="products" number="2" title="Products and Services We Offer" />
          <PolicyP>
            The Platform offers the following categories of paid products and services. The applicable billing
            and refund terms for each category are described in this Policy.
          </PolicyP>
          <PolicySubHeading number="2.1" title="Subscriptions" />
          <PolicyP>
            Subscription plans provide ongoing access to Platform features, including the Legal Library, AfCFTA
            Tools, and AI Legal Research, on a recurring monthly or annual billing basis. Subscriptions renew
            automatically at the end of each billing period unless cancelled in accordance with Section 5.
          </PolicyP>
          <PolicySubHeading number="2.2" title="The Yamalé Vault — Marketplace Purchases" />
          <PolicyP>
            The Yamalé Vault is a marketplace for legal and compliance content, including courses, webinars,
            document templates, and reference materials. Vault purchases are one-time transactions for access to
            specific content items. Vault content is available immediately upon payment confirmation.
          </PolicyP>
          <PolicySubHeading number="2.3" title="AfCFTA Passport and Compliance Tools" />
          <PolicyP>
            The AfCFTA Passport and related compliance tools may be offered as standalone products or included in
            subscription tiers. Where offered as a standalone purchase, the terms in Section 2.2 (one-time purchases)
            apply.
          </PolicyP>
          <PolicySubHeading number="2.4" title="Curated Lawyer Network" />
          <PolicyP>
            The Curated Lawyer Network (Find a Lawyer) is an invitation-only directory of verified legal
            professionals with expertise in African business law. Lawyers are admitted to the network by Yamalé at
            no cost. Access to the directory is included as a platform feature; no separate fee is charged to users
            for browsing or contacting listed lawyers.
          </PolicyP>
          <PolicySubHeading number="2.5" title="Legal Document Downloads" />
          <PolicyP>
            The Yamalé Legal Library provides access to laws, statutes, decrees, treaties, and other legal
            instruments across all 54 African countries. Depending on your subscription tier, downloads of
            individual legal documents may be included in your plan or available as standalone purchases. Where
            document downloads are included in your subscription, access is subject to any fair use limits
            applicable to your plan. Standalone document downloads are one-time purchases governed by the terms in
            Section 2.2.
          </PolicyP>
          <PolicyP>
            Downloaded documents are provided for personal and professional reference only and may not be
            redistributed, resold, or published without Yamalé&apos;s prior written consent.
          </PolicyP>

          <PolicySectionHeading id="payment-methods" number="3" title="Accepted Payment Methods" />
          <PolicyP>
            We accept the following forms of payment. All transactions are processed through our authorized payment
            processing partners. Yamalé does not store your card or wallet credentials. Payment details are held
            securely by our payment processors, and we retain only a secure token to process recurring charges on
            your behalf.
          </PolicyP>
          <PolicySubHeading number="3.1" title="Credit and Debit Cards" />
          <PolicyBulletList
            items={[
              "Visa (credit and debit)",
              "Mastercard (credit and debit)",
              "American Express",
              "Other internationally recognized card networks where supported by our payment processor",
            ]}
          />
          <PolicyP>
            Card payments are processed in USD. Your card issuer may apply foreign exchange or international
            transaction fees if your card is not denominated in USD. Yamalé is not responsible for fees applied by
            your card issuer.
          </PolicyP>
          <PolicySubHeading number="3.2" title="Mobile Money Wallets" />
          <PolicyP>
            We accept payments via the following mobile money services, subject to availability in your country:
          </PolicyP>
          <PolicyBulletList
            items={[
              "M-Pesa (Kenya, Tanzania, Ghana, and other supported markets)",
              "MTN Mobile Money / MoMo (Ghana, Uganda, Cameroon, Côte d’Ivoire, Rwanda, Zambia, and other supported markets)",
              "Orange Money (Senegal, Côte d’Ivoire, Mali, Burkina Faso, Guinea, and other supported markets)",
              "Wave (Senegal, Côte d’Ivoire, and other supported markets)",
              "Airtel Money (supported markets)",
              "Other local mobile wallets as made available at checkout",
            ]}
          />
          <PolicyP>
            Mobile money payments are processed in the local currency of the applicable wallet. Exchange rates and
            any applicable mobile operator fees are determined by your mobile network operator, not by Yamalé. You
            are responsible for ensuring your mobile wallet is sufficiently funded before initiating a transaction.
            Availability of specific mobile money providers varies by country. The payment options available to you
            will be displayed at checkout based on your location.
          </PolicyP>
          <PolicySubHeading number="3.3" title="Payment Processing Partners" />
          <PolicyP>
            Payments on the Yamalé Legal Platform are processed by our authorized payment processing partners. Card
            payments are processed by lomi.africa S.A.R.L (&ldquo;lomi.&rdquo;), a payment services company
            incorporated in Côte d&apos;Ivoire. lomi. acts as &ldquo;Merchant of Record&rdquo; for transactions
            processed via its platform, meaning lomi. is the entity of record for payment collection purposes.
            Mobile money payments are processed by lomi. and PawaPay Limited (&ldquo;PawaPay&rdquo;), a mobile money
            aggregator that supports a broad range of mobile wallets across Africa. By completing a payment, you
            agree to the terms of service of the applicable payment processor. Yamalé is not responsible for
            failures, delays, or errors attributable to payment processors or mobile network operators.
          </PolicyP>
          <PolicySubHeading number="3.4" title="Currency" />
          <PolicyP>
            All prices on the Platform are displayed in US Dollars (USD). Your bank or mobile network operator may
            apply conversion fees if your account is denominated in a different currency. Yamalé is not responsible
            for such fees.
          </PolicyP>

          <PolicySectionHeading id="billing" number="4" title="Billing and Payment Terms" />
          <PolicySubHeading number="4.1" title="Payment at Time of Purchase" />
          <PolicyP>
            All payments are due at the time of purchase or subscription activation. Access to paid features is
            granted upon confirmation of successful payment. Where payment fails or is declined, access will not be
            granted or will be suspended until payment is successfully completed.
          </PolicyP>
          <PolicySubHeading number="4.2" title="Subscription Billing Cycles" />
          <PolicyP>
            Monthly subscriptions: billed every 30 days from the date of activation. Annual subscriptions: billed
            once per year from the date of activation. Your billing date is set at the time of your initial
            subscription and remains the same for each renewal period unless your subscription is modified.
          </PolicyP>
          <PolicySubHeading number="4.3" title="Automatic Renewal" />
          <PolicyP>
            Subscriptions renew automatically at the end of each billing period at the then-current subscription
            price. You will receive a reminder notification at least seven (7) days before your subscription renews.
            By subscribing, you authorize Yamalé to charge your selected payment method for each renewal period
            until you cancel.
          </PolicyP>
          <PolicyP>
            <strong>For mobile money payments:</strong> where your mobile network operator supports recurring or
            scheduled payments, your wallet will be debited automatically on the renewal date. Where automatic debit
            is not supported by your operator, you will receive automated reminder notifications before your renewal
            date prompting you to authorize payment. If payment is not successfully received by the renewal date, a
            final reminder will be sent. Access will be suspended twelve (12) hours after the renewal date if
            payment has not been completed. This timeline is strictly applied; Yamalé does not extend grace periods
            beyond twelve (12) hours for mobile money renewals. Ensuring your mobile wallet is funded before the
            renewal date is your responsibility.
          </PolicyP>
          <PolicySubHeading number="4.4" title="Price Changes" />
          <PolicyP>
            Yamalé reserves the right to change subscription prices. You will be notified of any price change at
            least thirty (30) days before it takes effect. Your continued use of the Platform after the effective
            date of a price change constitutes acceptance of the new price. If you do not accept the new price, you
            may cancel your subscription before the change takes effect in accordance with Section 5.
          </PolicyP>
          <PolicySubHeading number="4.5" title="Taxes and Levies" />
          <PolicyP>
            Prices displayed on the Platform may or may not include applicable taxes, levies, or duties depending on
            your jurisdiction. Where required by applicable law, applicable taxes (including VAT, GST, or digital
            services taxes) will be added to your invoice and are your responsibility. Yamalé is not responsible for
            any withholding taxes, mobile operator levies, or government-imposed transaction fees applied by third
            parties.
          </PolicyP>
          <PolicySubHeading number="4.6" title="Invoices and Receipts" />
          <PolicyP>
            An electronic receipt will be sent to your registered email address upon each successful transaction.
            Receipts serve as your record of payment. If you require a formal invoice for business or tax purposes,
            contact <PolicyMailLink email={BILLING_EMAIL} /> within 30 days of the transaction.
          </PolicyP>

          <PolicySectionHeading id="cancellation" number="5" title="Cancellation" />
          <PolicySubHeading number="5.1" title="How to Cancel" />
          <PolicyP>
            You may cancel your subscription at any time through your account settings under &ldquo;Billing&rdquo; or
            by contacting <PolicyMailLink email={BILLING_EMAIL} />. Cancellation takes effect at the end of your current
            billing period. You will retain access to paid features until the end of the period for which you have
            already paid.
          </PolicyP>
          <PolicyP>
            For annual subscriptions, cancellation stops automatic renewal; it does not entitle you to a prorated
            refund for the unused portion of the annual period, except as provided in Section 6.
          </PolicyP>
          <PolicySubHeading number="5.2" title="Effect of Cancellation" />
          <PolicyP>
            Upon cancellation, your subscription will not renew. Your access to subscription-only features will end
            at the close of your current billing period. Content purchased through the Yamalé Vault remains
            accessible in accordance with the terms of that purchase, unless your account is terminated for breach
            of the Terms of Service.
          </PolicyP>
          <PolicySubHeading number="5.3" title="Cancellation by Yamalé" />
          <PolicyP>
            Yamalé reserves the right to suspend or terminate your account and access to paid services, without
            refund, if you violate the Terms of Service, engage in fraudulent activity, initiate an unjustified
            chargeback, or use the Platform in a manner that causes harm to other users or to Yamalé.
          </PolicyP>

          <PolicySectionHeading id="refunds" number="6" title="Refund Policy" />
          <PolicySubHeading number="6.1" title="General Principle" />
          <PolicyP>
            Yamalé operates a platform that delivers immediate access to digital content and services. Because
            access is granted at the moment of payment, refunds are not automatically available. However, we
            recognize that issues can arise and we handle refund requests fairly on a case-by-case basis within the
            framework below.
          </PolicyP>
          <PolicyCallout label="Please note">
            The transaction processing fee applied to your original payment is non-refundable in all cases. Any
            approved refund will be for the amount you paid minus the processing fee that was applied at the time of
            the transaction.
          </PolicyCallout>
          <PolicySubHeading number="6.2" title="Subscriptions — Cooling-Off Period" />
          <PolicyP>
            If you are a new subscriber and you cancel your subscription within fourteen (14) days of your initial
            payment (the &ldquo;Cooling-Off Period&rdquo;), you are entitled to a full refund of that initial
            payment, provided that you have not made substantial use of the Platform during that period. Substantial
            use includes submitting more than two (2) AI Legal Research queries.
          </PolicyP>
          <PolicyP>
            The 14-day Cooling-Off Period applies to subscription payments only. It does not apply to Yamalé Vault
            purchases, renewal charges, annual subscription upgrades, or any subsequent billing period.
          </PolicyP>
          <PolicyP>
            This cooling-off period is consistent with consumer protection provisions applicable in the EU, UK, and a
            number of African jurisdictions including Kenya and South Africa. Users in other jurisdictions may have
            additional statutory rights under local law.
          </PolicyP>
          <PolicySubHeading number="6.3" title="Subscriptions — Renewals" />
          <PolicyP>
            Renewal charges are generally non-refundable. If you forget to cancel before a renewal date, contact{" "}
            <PolicyMailLink email={BILLING_EMAIL} /> within three (3) days of the renewal charge. We will consider refund
            requests in this window where: (a) you have not used the Platform in the renewed period; and (b) the
            request is your first such request. We reserve the right to decline refund requests that appear abusive
            or repetitive.
          </PolicyP>
          <PolicySubHeading number="6.4" title="Yamalé Vault — One-Time Purchases" />
          <PolicyP>
            Vault purchases are non-refundable once content has been accessed, downloaded, or viewed, because the
            digital content is delivered immediately upon payment. If you experience a technical failure that
            prevents access to purchased content, contact <PolicyMailLink email={BILLING_EMAIL} /> within seven (7) days
            with a description of the issue and we will either resolve the access issue or issue a full refund.
          </PolicyP>
          <PolicySubHeading number="6.5" title="Refunds for Platform Errors or Service Failures" />
          <PolicyP>
            If a service failure, technical error, or outage on Yamalé&apos;s part prevents you from accessing a
            paid feature for a cumulative period of more than 48 hours within a billing period, you are entitled to
            a prorated credit for the affected period. This credit will be applied to your next billing cycle. To
            claim a service failure credit, contact <PolicyMailLink email={BILLING_EMAIL} /> within 14 days of the incident
            with details of the issue.
          </PolicyP>
          <PolicySubHeading number="6.6" title="Duplicate or Erroneous Charges" />
          <PolicyP>
            If you are charged more than once for the same transaction, or charged an incorrect amount, contact{" "}
            <PolicyMailLink email={BILLING_EMAIL} /> immediately. We will investigate and issue a full refund of any
            duplicate or erroneous charge within ten (10) business days of confirming the error.
          </PolicyP>
          <PolicySubHeading number="6.7" title="Refund Method" />
          <PolicyP>
            Approved refunds will be returned to the original payment method used for the transaction:
          </PolicyP>
          <PolicyBulletList
            items={[
              "Credit or debit card refunds: processed within 5–10 business days of approval, subject to your card issuer’s processing times.",
              "Mobile money refunds: processed within 5–10 business days of approval to the originating mobile wallet. Where a direct wallet reversal is not technically supported by the operator, Yamalé will work with you to arrange an alternative refund method.",
              "Local bank transfer (UEMOA region): processed within 5–10 business days of approval.",
            ]}
          />
          <PolicyP>
            Yamalé cannot issue refunds to a different payment method than the one originally used, except where the
            original method is no longer available, in which case you should contact{" "}
            <PolicyMailLink email={BILLING_EMAIL} />.
          </PolicyP>
          <PolicyP>
            Refunds are initiated after Yamalé has confirmed receipt of the corresponding funds from its payment
            processor. Settlement timelines vary by payment method and processor. In cases of verified platform error
            or duplicate charge, we will begin the refund process upon confirmation of the error, independently of
            settlement status.
          </PolicyP>
          <PolicySubHeading number="6.8" title="How to Request a Refund" />
          <PolicyP>
            To request a refund, email <PolicyMailLink email={BILLING_EMAIL} /> with the subject line &ldquo;Refund Request
            — [Your Name]&rdquo; and include: your account email address, the date of the transaction, the amount
            charged, the payment method used, and the reason for your request. We will acknowledge your request
            within two (2) business days and aim to resolve it within ten (10) business days.
          </PolicyP>

          <PolicySectionHeading id="disputes" number="7" title="Failed and Disputed Transactions" />
          <PolicySubHeading number="7.1" title="Failed Payments" />
          <PolicyP>
            If a payment fails (due to insufficient funds, expired card, wallet deactivation, operator downtime, or
            other reasons), we will notify you and provide an opportunity to update your payment method. Yamalé is
            not responsible for transaction failures caused by your payment provider, mobile network operator, or
            bank.
          </PolicyP>
          <PolicyP>
            <strong>For mobile money payments:</strong> failed transactions where funds have been debited from your
            wallet but not received by Yamalé should be reported to <PolicyMailLink email={BILLING_EMAIL} /> with your
            transaction reference number. We will investigate within five (5) business days. If funds were debited
            and not received, we will either apply the payment to your account or coordinate a reversal with the
            payment processor.
          </PolicyP>
          <PolicySubHeading number="7.2" title="Transaction Disputes and Chargebacks" />
          <PolicyP>
            If you believe a charge is unauthorized or incorrect, please contact <PolicyMailLink email={BILLING_EMAIL} />{" "}
            before initiating a dispute or chargeback with your bank or card issuer. We will work to resolve the
            issue directly and promptly.
          </PolicyP>
          <PolicyCallout label="Important">
            Initiating a chargeback for a charge that is valid under this Policy may result in immediate suspension
            of your account pending investigation, and may result in permanent termination of your account if the
            chargeback is found to be unjustified. Chargeback processing fees are charged by our payment processor
            at a flat rate of 10,000 F CFA per chargeback (or USD $15 / EUR €15 for transactions processed in those
            currencies). These fees are non-refundable regardless of the outcome of the dispute. Yamalé reserves
            the right to recover the disputed amount, together with any chargeback fees incurred, from any
            outstanding amounts owed to you.
          </PolicyCallout>
          <PolicyP>
            <strong>For mobile money disputes:</strong> if you believe an incorrect amount was deducted from your
            mobile wallet, you should also contact your mobile network operator directly, as operators have their
            own dispute resolution processes. Yamalé will cooperate with operator-initiated investigations.
          </PolicyP>
          <PolicySubHeading number="7.3" title="Fraud and Unauthorized Transactions" />
          <PolicyP>
            If you suspect fraudulent use of your payment method on the Platform, contact <PolicyMailLink email={BILLING_EMAIL} />{" "}
            and your payment provider immediately. Yamalé will suspend the affected account pending investigation
            upon receipt of a credible fraud report.
          </PolicyP>

          <PolicySectionHeading id="promotions" number="8" title="Promotions, Trials, and Discounts" />
          <PolicySubHeading number="8.1" title="Free Trials" />
          <PolicyP>
            Where Yamalé offers a free trial period, no charge is made during the trial. At the end of the trial,
            your subscription will automatically convert to a paid plan and your selected payment method will be
            charged unless you cancel before the trial period ends. You will receive a reminder before the trial
            ends.
          </PolicyP>
          <PolicySubHeading number="8.2" title="Promotional Pricing" />
          <PolicyP>
            Promotional or discounted pricing applies only for the promotional period stated at the time of
            subscription. At the end of the promotional period, your subscription will renew at the standard price.
            You will be notified of this change before it takes effect.
          </PolicyP>
          <PolicySubHeading number="8.3" title="Discount Codes and Coupons" />
          <PolicyP>
            Discount codes and coupons are valid only for the specific products, dates, and conditions stated. They
            cannot be combined with other promotions, applied retroactively, redeemed for cash, or transferred.
            Misuse of promotional codes may result in cancellation of the associated subscription or purchase
            without refund.
          </PolicyP>

          <PolicySectionHeading id="enterprise" number="9" title="Enterprise and Institutional Accounts" />
          <PolicyP>
            Law firms, government institutions, and corporate clients purchasing multi-seat subscriptions or
            enterprise licenses are subject to the payment and refund terms set out in their applicable master
            services agreement or institutional license agreement. Where no separate agreement exists, this Policy
            applies.
          </PolicyP>
          <PolicyP>
            Invoiced enterprise clients are subject to payment terms agreed in writing. Late payments may attract
            interest at the rate of 1.5% per month or the maximum rate permitted by applicable law, whichever is
            lower.
          </PolicyP>

          <PolicySectionHeading id="governing-law" number="10" title="Governing Law and Disputes" />
          <PolicyP>
            This Policy is governed by the laws of Senegal. Disputes arising from billing or payment matters that
            cannot be resolved through the process described in this Policy may be referred to the competent courts
            of Dakar, Senegal, or resolved through arbitration as provided in the Yamalé Terms of Service.
          </PolicyP>
          <PolicyP>
            Nothing in this Policy limits your statutory rights under the consumer protection or data protection laws
            applicable in your jurisdiction.
          </PolicyP>

          <PolicySectionHeading id="contact" number="11" title="Contact Us" />
          <PolicyP>For all billing and payment inquiries:</PolicyP>
          <PolicyBulletList
            items={[
              <>
                <strong>Email:</strong> <PolicyMailLink email={BILLING_EMAIL} />
              </>,
              <>
                <strong>Subject line:</strong> include &ldquo;Billing&rdquo; or &ldquo;Refund Request&rdquo; for
                faster routing
              </>,
              <>
                <strong>Response time:</strong> within two (2) business days
              </>,
              <>
                <strong>Address:</strong> Yamalé, Dakar, Senegal
              </>,
            ]}
          />

          <PolicySectionHeading id="changes" number="12" title="Changes to This Policy" />
          <PolicyP>
            Yamalé reserves the right to update this Policy from time to time. Material changes — including changes
            to refund terms, accepted payment methods, or billing cycles — will be communicated by email and posted
            on the Platform at least fourteen (14) days before they take effect. Your continued use of the Platform
            after the effective date constitutes acceptance of the revised Policy.
          </PolicyP>

          <PolicyUpdatedBanner>
            This Payment &amp; Refund Policy was last updated in <strong>May 2026</strong> (Version 1.0). For
            questions, contact <PolicyMailLink email={BILLING_EMAIL} />.
          </PolicyUpdatedBanner>
        </div>

        <PolicyFooterNav
          links={[
            { href: "/terms", label: "Terms of Service" },
            { href: "/privacy", label: "Privacy Policy" },
            { href: "/", label: "Home" },
          ]}
        />
      </div>
    </div>
  );
}
