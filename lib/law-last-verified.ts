/** Last verified timestamp for library laws (displayed as “Last verified May 2026”). */

export function touchLawLastVerifiedAt(): string {
  return new Date().toISOString();
}

/** e.g. "May 2026" */
export function formatLawLastVerifiedMonthYear(
  iso: string | null | undefined,
  locale = "en-GB"
): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

export function formatLawLastVerifiedLabel(iso: string | null | undefined): string | null {
  const monthYear = formatLawLastVerifiedMonthYear(iso);
  return monthYear ? `Last verified ${monthYear}` : null;
}

/** Merge into an admin/script law update payload. */
export function withLawLastVerified<T extends Record<string, unknown>>(updates: T): T & { last_verified_at: string } {
  return { ...updates, last_verified_at: touchLawLastVerifiedAt() };
}
