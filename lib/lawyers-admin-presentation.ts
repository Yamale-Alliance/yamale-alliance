/** Admins preview the public directory with all profiles unmasked (no paywall). */

export function lawyerUnlockedForViewer(
  _lawyer: { id: string; country: string },
  options: {
    isAdmin: boolean;
    dayPassActive: boolean;
    unlockedIds: Set<string>;
  }
): boolean {
  if (options.isAdmin) return true;
  return options.dayPassActive || options.unlockedIds.has(_lawyer.id);
}
