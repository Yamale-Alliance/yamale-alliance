import {
  PLATFORM_BUSINESS_EMAIL,
  PLATFORM_MAIL_LINK_REL,
  platformBusinessMailto,
} from "@/lib/platform-emails";

/** Yamalé Advisory contact for Law Firm Development Package Tier 2 & 3. */
export const LAW_FIRM_ADVISORY_EMAIL = PLATFORM_BUSINESS_EMAIL;

export const LAW_FIRM_MAIL_LINK_REL = PLATFORM_MAIL_LINK_REL;

export type LawFirmEnrollmentTier = 2 | 3;

const TIER_SUBJECTS: Record<LawFirmEnrollmentTier, string> = {
  2: "Law Firm Development Package — Tier 2 enrollment",
  3: "Law Firm Development Package — Tier 3 enquiry",
};

const TIER_LABELS: Record<LawFirmEnrollmentTier, string> = {
  2: "Tier 2 — Guided Implementation",
  3: "Tier 3 — Guided Implementation with Yamalé",
};

export function lawFirmTierLabel(tier: LawFirmEnrollmentTier): string {
  return TIER_LABELS[tier];
}

export function lawFirmTierEnrollmentMailto(tier: LawFirmEnrollmentTier): string {
  return platformBusinessMailto(TIER_SUBJECTS[tier]);
}

/** General Law Firm package enquiry (no specific tier). */
export function lawFirmAdvisoryMailto(): string {
  return platformBusinessMailto("Law Firm Development Package enquiry");
}

export function lawFirmTierEnrollmentMailLinkProps(tier: LawFirmEnrollmentTier): {
  href: string;
  target: "_blank";
  rel: string;
} {
  return {
    href: lawFirmTierEnrollmentMailto(tier),
    target: "_blank",
    rel: LAW_FIRM_MAIL_LINK_REL,
  };
}

export function lawFirmAdvisoryMailLinkProps(): {
  href: string;
  target: "_blank";
  rel: string;
} {
  return {
    href: lawFirmAdvisoryMailto(),
    target: "_blank",
    rel: LAW_FIRM_MAIL_LINK_REL,
  };
}

export function lawFirmTierEnrollmentContactPath(tier: LawFirmEnrollmentTier): string {
  return `/contact?product=law-firm-development&tier=${tier}`;
}

export function parseLawFirmEnrollmentTier(
  value: string | null | undefined
): LawFirmEnrollmentTier | null {
  if (value === "2") return 2;
  if (value === "3") return 3;
  return null;
}
