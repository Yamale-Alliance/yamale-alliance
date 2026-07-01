/**
 * Plan limits for Basic, Pro, and Team.
 * Used for AI queries, document downloads, AfCFTA reports, lawyer contacts, and feature flags.
 */

export type PlanTier = "free" | "basic" | "pro" | "team";

/** AI queries per month. null = unlimited. */
export const AI_QUERY_LIMITS: Record<PlanTier, number | null> = {
  free: 0,
  basic: 10,
  pro: 50,
  team: null,
};

/** Document downloads per month. null = unlimited. */
export const DOCUMENT_DOWNLOAD_LIMITS: Record<PlanTier, number | null> = {
  free: 0,
  basic: 5,
  pro: 20,
  team: 250, // 50 per user × 5 seats; applied at org level
};

/** AfCFTA reports per month. null = unlimited. */
export const AFCFTA_REPORT_LIMITS: Record<PlanTier, number | null> = {
  free: 0,
  basic: 1,
  pro: 5,
  team: null,
};

/** Lawyer contacts (unlocks) per month. null = unlimited. */
export const LAWYER_CONTACT_LIMITS: Record<PlanTier, number | null> = {
  free: 0,
  basic: 0,
  pro: 3,
  team: 10,
};

/** Team seats (Team plan only). */
export const TEAM_SEATS: Record<PlanTier, number | null> = {
  free: null,
  basic: null,
  pro: null,
  team: 5,
};

/** Map legacy Clerk tiers to current plan tiers (`plus` was the old Team slug). */
export function normalizePlanTier(tier: string | null | undefined): PlanTier {
  const t = (tier ?? "free").toLowerCase();
  if (t === "plus" || t === "team") return "team";
  if (t === "pro" || t === "basic" || t === "free") return t;
  return "free";
}

/** Share menu (copy chat) — Basic+ and pay-as-you-go AI users. */
export function canShareChat(tier: string, payAsYouGoCount = 0): boolean {
  const n = normalizePlanTier(tier);
  if (n === "basic" || n === "pro" || n === "team") return true;
  return n === "free" && payAsYouGoCount > 0;
}

/** Share by email (Pro, Team). */
export function canShareByEmail(tier: string): boolean {
  const n = normalizePlanTier(tier);
  return n === "pro" || n === "team";
}

/** Download AI conversations as PDF (Pro, Team). */
export function canDownloadConversations(tier: string): boolean {
  const n = normalizePlanTier(tier);
  return n === "pro" || n === "team";
}

export function getAiQueryLimit(tier: string): number | null {
  return AI_QUERY_LIMITS[normalizePlanTier(tier)];
}

export function getDocumentDownloadLimit(tier: string): number | null {
  const t = (tier || "free").toLowerCase() as PlanTier;
  return t in DOCUMENT_DOWNLOAD_LIMITS ? DOCUMENT_DOWNLOAD_LIMITS[t as PlanTier] : 0;
}

export function getAfCFTAReportLimit(tier: string): number | null {
  const t = (tier || "free").toLowerCase() as PlanTier;
  return t in AFCFTA_REPORT_LIMITS ? AFCFTA_REPORT_LIMITS[t as PlanTier] : 0;
}

export function getLawyerContactLimit(tier: string): number | null {
  const t = (tier || "free").toLowerCase() as PlanTier;
  return t in LAWYER_CONTACT_LIMITS ? LAWYER_CONTACT_LIMITS[t as PlanTier] : 0;
}
