/** Bump when the note copy changes materially — triggers a new one-time prompt. */
export const FOUNDERS_NOTE_VERSION = "v1";

export const FOUNDERS_NOTE_STORAGE_KEY = `yamale-founders-note:${FOUNDERS_NOTE_VERSION}`;

export const FOUNDERS_NOTE_METADATA_KEY = `founders_note_seen_${FOUNDERS_NOTE_VERSION}`;

/** Routes where the one-time welcome dialog should not auto-open. */
export function shouldSkipFoundersNoteAutoPrompt(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname.startsWith("/founders-note")) return true;
  if (pathname.startsWith("/admin-panel")) return true;
  if (pathname.startsWith("/ai-research")) return true;
  if (pathname.startsWith("/library")) return true;
  if (pathname.startsWith("/marketplace")) return true;
  if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) return true;
  return false;
}

export function readFoundersNoteSeenFromStorage(userKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(FOUNDERS_NOTE_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    return Boolean(map[userKey]);
  } catch {
    return false;
  }
}

export function writeFoundersNoteSeenToStorage(userKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(FOUNDERS_NOTE_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    map[userKey] = true;
    localStorage.setItem(FOUNDERS_NOTE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
