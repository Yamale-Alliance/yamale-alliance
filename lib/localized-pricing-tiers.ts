type Translator = {
  (key: string, values?: Record<string, string | number>): string;
  raw: (key: string) => unknown;
};

export type PricingTierApi = {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnualPerMonth: number;
  priceAnnualTotal: number;
  description: string;
  subtitle?: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

export type LocalizedPricingTier = PricingTierApi & {
  localizedFeatures: string[];
  localizedName: string;
  localizedCta: string;
};

const AI_TIER_IDS = new Set(["basic", "pro", "team"]);

export function localizeAiPricingTiers(
  apiTiers: PricingTierApi[],
  tPricing: Translator
): LocalizedPricingTier[] {
  return apiTiers
    .filter((tier) => AI_TIER_IDS.has(tier.id))
    .map((tier) => {
      const rawFeatures = tPricing.raw(`planFeatures.${tier.id}`);
      const localizedFeatures = Array.isArray(rawFeatures)
        ? (rawFeatures as string[]).filter((f) => typeof f === "string" && f.trim())
        : [];

      return {
        ...tier,
        localizedName: tPricing(`tiers.${tier.id}`),
        localizedCta: tPricing(`cta.${tier.id}`),
        localizedFeatures:
          localizedFeatures.length > 0 ? localizedFeatures : tier.features.slice(0, 5),
      };
    });
}
