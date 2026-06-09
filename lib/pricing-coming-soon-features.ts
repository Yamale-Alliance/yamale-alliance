/** Tier / pricing copy for products not yet publicly available. */
export const PRICING_AFCFTA_COMING_SOON = "AfCFTA Passport (coming soon)";
export const PRICING_LAWYERS_COMING_SOON = "Lawyers network (coming soon)";

/** Rewrites lawyer / AfCFTA plan bullets from DB or fallbacks to coming-soon lines. */
export function applyPricingComingSoonFeatures(features: string[]): string[] {
  return features.map((feature) => {
    const plain = feature.replace(/<[^>]*>/g, " ").toLowerCase();
    if (plain.includes("afcfta")) return PRICING_AFCFTA_COMING_SOON;
    if (plain.includes("lawyer")) return PRICING_LAWYERS_COMING_SOON;
    return feature;
  });
}

/** Removes document download / save limits from public pricing tier bullets. */
export function stripDocumentDownloadPricingFeatures(features: string[]): string[] {
  return features.filter((feature) => {
    const plain = feature.replace(/<[^>]*>/g, " ").toLowerCase();
    if (plain.includes("save up to") && plain.includes("document")) return false;
    if (plain.includes("document download")) return false;
    if (plain.includes("downloads") && (plain.includes("month") || plain.includes("user"))) return false;
    return true;
  });
}

export function normalizePricingFeatures(features: string[]): string[] {
  return stripDocumentDownloadPricingFeatures(applyPricingComingSoonFeatures(features));
}
