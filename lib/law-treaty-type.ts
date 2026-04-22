export const LAW_TREATY_TYPES = ["Bilateral", "Multilateral", "Not a treaty"] as const;

export type LawTreatyType = (typeof LAW_TREATY_TYPES)[number];

export function isLawTreatyType(value: unknown): value is LawTreatyType {
  return typeof value === "string" && LAW_TREATY_TYPES.includes(value as LawTreatyType);
}
