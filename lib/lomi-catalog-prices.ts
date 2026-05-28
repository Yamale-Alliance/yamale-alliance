/**
 * Lomi dashboard price IDs (recurring subscriptions + one-time PAYG).
 * @see .env.example LOMI_PRICE_*
 */

export type LomiSubscriptionPlanId = "basic" | "pro" | "team";
export type LomiSubscriptionInterval = "monthly" | "annual";

export type LomiCatalogOneTimeKey =
  | "day_pass"
  | "payg_document"
  | "payg_ai_query"
  | "payg_afcfta_report"
  | "payg_lawyer_search"
  | "lawyer_unlock"
  | "team_extra_seat";

const SUBSCRIPTION_ENV: Record<
  LomiSubscriptionPlanId,
  Record<LomiSubscriptionInterval, string>
> = {
  basic: {
    monthly: "LOMI_PRICE_BASIC_MONTHLY",
    annual: "LOMI_PRICE_BASIC_ANNUAL",
  },
  pro: {
    monthly: "LOMI_PRICE_PRO_MONTHLY",
    annual: "LOMI_PRICE_PRO_ANNUAL",
  },
  team: {
    monthly: "LOMI_PRICE_TEAM_MONTHLY",
    annual: "LOMI_PRICE_TEAM_ANNUAL",
  },
};

const ONE_TIME_ENV: Record<LomiCatalogOneTimeKey, string | [string, string]> = {
  day_pass: "LOMI_PRICE_DAY_PASS",
  payg_document: "LOMI_PRICE_PAYG_DOCUMENT",
  payg_ai_query: "LOMI_PRICE_PAYG_AI_QUERY",
  payg_afcfta_report: "LOMI_PRICE_PAYG_AFCFTA_REPORT",
  payg_lawyer_search: "LOMI_PRICE_PAYG_LAWYER_SEARCH",
  lawyer_unlock: ["LOMI_PRICE_LAWYER_UNLOCK", "LOMI_PRICE_PAYG_LAWYER_SEARCH"],
  team_extra_seat: "LOMI_PRICE_TEAM_EXTRA_SEAT",
};

function readEnvPriceId(envKey: string): string | null {
  const v = process.env[envKey]?.trim();
  return v && v.length > 0 ? v : null;
}

export function getLomiSubscriptionPriceId(
  planId: string,
  interval: LomiSubscriptionInterval
): string | null {
  const plan = planId as LomiSubscriptionPlanId;
  if (!(plan in SUBSCRIPTION_ENV)) return null;
  return readEnvPriceId(SUBSCRIPTION_ENV[plan][interval]);
}

export function getLomiCatalogPriceId(key: LomiCatalogOneTimeKey): string | null {
  const spec = ONE_TIME_ENV[key];
  if (typeof spec === "string") return readEnvPriceId(spec);
  for (const envKey of spec) {
    const id = readEnvPriceId(envKey);
    if (id) return id;
  }
  return null;
}
