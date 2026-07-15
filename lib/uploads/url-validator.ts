import net from "node:net";

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

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) return isPrivateIpv4(host);
  if (ipVersion === 6) return isPrivateIpv6(host);
  return false;
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

  if (parsed.protocol !== "https:") {
    return false;
  }

  if (isPrivateOrLocalHost(parsed.hostname)) {
    return false;
  }

  const host = normalizeHostname(parsed.hostname);

  return LEGAL_SOURCE_DOMAIN_ALLOWLIST.some((entry) => {
    const allowed = normalizeHostname(entry);
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}

export const LEGAL_SOURCE_DOMAIN_REJECT_MESSAGE =
  "URL must use HTTPS and be on the approved legal source list";
