/** Sales, advisory, institutional, and package enquiries. */
export const PLATFORM_BUSINESS_EMAIL = "info@yamalealliance.org";

/** Technical support, bugs, and account issues. */
export const PLATFORM_TECHNICAL_EMAIL = "it@yamalealliance.org";

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
