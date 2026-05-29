import { CLERK_PUBLISHABLE_KEY } from "@/lib/clerk-config";

/** Decode Frontend API host embedded in pk_test_* / pk_live_* (e.g. clerk.yamalelegal.com). */
function getClerkHostsFromPublishableKey(publishableKey: string): string[] {
  const hosts: string[] = [];
  const match = /^pk_(?:test|live)_(.+)$/i.exec(publishableKey.trim());
  if (!match) return hosts;

  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf-8");
    const frontendApi = decoded.split("$")[0]?.trim();
    if (!frontendApi || !frontendApi.includes(".")) return hosts;

    hosts.push(`https://${frontendApi}`);

    if (frontendApi.startsWith("clerk.")) {
      const root = frontendApi.slice("clerk.".length);
      hosts.push(`https://accounts.${root}`);
      hosts.push(`https://*.${root}`);
    }
  } catch {
    /* ignore invalid key */
  }

  return hosts;
}

/** Clerk script/connect/frame hosts for Content-Security-Policy (dev + production). */
export function getClerkCspHosts(): string[] {
  const hosts = new Set<string>([
    "https://*.clerk.accounts.dev",
    "https://*.accounts.dev",
    "https://*.clerk.com",
    "https://clerk.com",
    "https://*.clerk.dev",
    "https://frontend-api.clerk.dev",
    "https://api.clerk.com",
  ]);

  for (const host of getClerkHostsFromPublishableKey(CLERK_PUBLISHABLE_KEY)) {
    hosts.add(host);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      const { hostname } = new URL(appUrl);
      const root = hostname.replace(/^www\./i, "");
      hosts.add(`https://${hostname}`);
      hosts.add(`https://${root}`);
      hosts.add(`https://www.${root}`);
      hosts.add(`https://clerk.${root}`);
      hosts.add(`https://accounts.${root}`);
      hosts.add(`https://*.${root}`);
    } catch {
      /* ignore invalid URL */
    }
  }

  const frontendApi =
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API?.trim() ||
    process.env.CLERK_FRONTEND_API?.trim();
  if (frontendApi) {
    try {
      const normalized = frontendApi.startsWith("http") ? frontendApi : `https://${frontendApi}`;
      const { hostname } = new URL(normalized);
      hosts.add(`https://${hostname}`);
    } catch {
      /* ignore */
    }
  }

  return [...hosts];
}
