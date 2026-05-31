/** Sales, advisory, institutional, and package enquiries (Yamalé Advisory). */
export const PLATFORM_BUSINESS_EMAIL = "info@yamaleadvisory.com";

/** Technical support, bugs, and account issues — same inbox as business contact. */
export const PLATFORM_TECHNICAL_EMAIL = "info@yamaleadvisory.com";

export const PLATFORM_MAIL_LINK_REL = "noopener noreferrer";

export function platformBusinessMailto(
  subject: string,
  options?: { body?: string }
): string {
  const params = new URLSearchParams({ subject });
  if (options?.body) params.set("body", options.body);
  return `mailto:${PLATFORM_BUSINESS_EMAIL}?${params.toString()}`;
}

export function platformTechnicalMailto(subject: string): string {
  return `mailto:${PLATFORM_TECHNICAL_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
