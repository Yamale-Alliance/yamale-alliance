/**
 * In-memory store for lawyer contact unlocks (user_id + lawyer_id).
 * Replace with database (e.g. Prisma) for production.
 */
const unlocks = new Map<string, Set<string>>(); // userId -> Set of lawyerIds

export function getUnlockedLawyerIds(userId: string): string[] {
  const set = unlocks.get(userId);
  return set ? Array.from(set) : [];
}

export function recordUnlock(userId: string, lawyerId: string): void {
  let set = unlocks.get(userId);
  if (!set) {
    set = new Set();
    unlocks.set(userId, set);
  }
  set.add(lawyerId);
}
