import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import {
  LAW_FIRM_ADVISORY_EMAIL,
  LAW_FIRM_MAIL_LINK_REL,
  lawFirmAdvisoryMailto,
  lawFirmTierEnrollmentMailto,
  lawFirmTierLabel,
  parseLawFirmEnrollmentTier,
} from "@/lib/law-firm-enrollment-contact";

export const metadata: Metadata = {
  title: "Contact Yamalé Advisory",
  description:
    "Enquire about the African Law Firm Development Package and other Yamalé Advisory services.",
};

type Props = {
  searchParams?: { product?: string; tier?: string };
};

export default function ContactPage({ searchParams }: Props) {
  const tier = parseLawFirmEnrollmentTier(searchParams?.tier);
  const isLawFirm =
    searchParams?.product === "law-firm-development" || tier !== null;

  const heading = tier
    ? lawFirmTierLabel(tier)
    : isLawFirm
      ? "Law Firm Development Package"
      : "Contact Yamalé Advisory";

  const intro = tier
    ? tier === 2
      ? "Tell us about your firm and timeline for guided implementation (Tier 2). We will reply with enrollment options and next steps."
      : "Tell us about your firm and goals for a Tier 3 engagement with Yamalé Advisory. We will follow up to scope the roadmap."
    : "For advisory services, package enquiries, or partnership questions, email our team and we will respond as soon as we can.";

  const mailto = tier ? lawFirmTierEnrollmentMailto(tier) : lawFirmAdvisoryMailto();

  return (
    <div className="min-h-screen bg-[#221913] text-white">
      <div className="border-b border-[rgba(193,140,67,0.2)] px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/65 transition hover:text-[#E3BA65]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to The Yamalé Vault
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C18C43]">Yamalé Advisory</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {heading}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/70">{intro}</p>

        <div className="mt-10 rounded-xl border border-[rgba(193,140,67,0.25)] bg-white/[0.04] p-6 sm:p-8">
          <p className="text-sm text-white/55">Email</p>
          <a
            href={mailto}
            target="_blank"
            rel={LAW_FIRM_MAIL_LINK_REL}
            className="mt-1 block text-lg font-medium text-[#E3BA65] hover:underline"
          >
            {LAW_FIRM_ADVISORY_EMAIL}
          </a>
          <a
            href={mailto}
            target="_blank"
            rel={LAW_FIRM_MAIL_LINK_REL}
            className="mt-6 inline-flex items-center gap-2 rounded-[2px] bg-[#C18C43] px-6 py-3 text-sm font-semibold text-[#221913] transition hover:bg-[#E3BA65]"
          >
            <Mail className="h-4 w-4" />
            {tier ? "Open email to enquire" : "Send an email"}
          </a>
          <p className="mt-4 text-sm text-white/45">
            If your device does not open a mail app, copy{" "}
            <span className="text-white/70">{LAW_FIRM_ADVISORY_EMAIL}</span> into your email client.
          </p>
        </div>

        {tier && (
          <p className="mt-8 text-sm text-white/50">
            Prefer to browse the package first?{" "}
            <Link href="/marketplace" className="font-medium text-[#E3BA65] hover:underline">
              Return to the Vault
            </Link>{" "}
            and open the Law Firm Development Package page.
          </p>
        )}
      </div>
    </div>
  );
}
