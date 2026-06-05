/** Trusted legal source domains for PDF ingestion (extend as needed). */
export const LEGAL_SOURCE_DOMAIN_ALLOWLIST = [
  "droit-afrique.com",
  "www.droit-afrique.com",
  "ohada.com",
  "www.ohada.com",
  "juriafrica.com",
  "www.juriafrica.com",
  "africanlawlibrary.com",
  "www.africanlawlibrary.com",
  "government.za",
  "www.gov.za",
  "gazettes.africa",
  "www.gazettes.africa",
  "kenyalaw.org",
  "www.kenyalaw.org",
  "nigeralaw.org",
  "www.nigeralaw.org",
  "laws.africa",
  "www.laws.africa",
  "worldbank.org",
  "www.worldbank.org",
  "unctad.org",
  "www.unctad.org",
  "au.int",
  "www.au.int",
  "tradebarriers.africa",
  "www.tradebarriers.africa",
] as const;

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

/**
 * Returns true when the URL host matches an approved legal source domain
 * (exact match or subdomain of an allowlisted root).
 */
export function isAllowedLegalSource(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const host = normalizeHostname(parsed.hostname);

  return LEGAL_SOURCE_DOMAIN_ALLOWLIST.some((entry) => {
    const allowed = normalizeHostname(entry);
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}

export const LEGAL_SOURCE_DOMAIN_REJECT_MESSAGE = "Domain not in approved sources list";
