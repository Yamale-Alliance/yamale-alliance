/** Admin demo on /lawyers: Zambia locked, Senegal unlocked (regardless of purchase). */

export function lawyerUnlockedForViewer(
  lawyer: { id: string; country: string },
  options: {
    isAdmin: boolean;
    dayPassActive: boolean;
    unlockedIds: Set<string>;
  }
): boolean {
  const normallyUnlocked = options.dayPassActive || options.unlockedIds.has(lawyer.id);
  if (!options.isAdmin) return normallyUnlocked;
  if (lawyer.country === "Zambia") return false;
  if (lawyer.country === "Senegal") return true;
  return normallyUnlocked;
}
