/** Tier / pricing copy for products not yet publicly available. */
export const PRICING_LAWYERS_NETWORK_FEATURE = "Lawyers network directory search";

/** Removes AfCFTA and other retired product bullets from public pricing copy. */
export function applyPricingComingSoonFeatures(features: string[]): string[] {
  return features.filter((feature) => {
    const plain = feature.replace(/<[^>]*>/g, " ").toLowerCase();
    return !plain.includes("afcfta");
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
