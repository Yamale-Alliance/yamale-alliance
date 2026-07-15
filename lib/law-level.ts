export const LAW_LEVELS = ["National", "Regional", "International"] as const;

export type LawLevel = (typeof LAW_LEVELS)[number];

export const DEFAULT_LAW_LEVEL: LawLevel = "National";

export function isLawLevel(value: unknown): value is LawLevel {
  return typeof value === "string" && LAW_LEVELS.includes(value as LawLevel);
}
