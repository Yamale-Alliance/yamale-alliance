/** Clerk private metadata: last lawyers join onboarding video URL the user dismissed. */
export const LAWYERS_ONBOARDING_VIDEO_METADATA_KEY = "lawyers_onboarding_video_seen_url";

export const LAWYERS_ONBOARDING_VIDEO_STORAGE_KEY = "yamale-lawyers-onboarding-video";

/** Routes where the onboarding video auto-opens once (Find a Lawyer tab). */
export function shouldAutoPromptLawyersOnboardingVideo(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/lawyers";
}

export function readLawyersOnboardingSeenFromStorage(userKey: string, videoUrl: string): boolean {
  if (typeof window === "undefined" || !videoUrl) return false;
  try {
    const raw = localStorage.getItem(LAWYERS_ONBOARDING_VIDEO_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return map[userKey] === videoUrl;
  } catch {
    return false;
  }
}

export function writeLawyersOnboardingSeenToStorage(userKey: string, videoUrl: string): void {
  if (typeof window === "undefined" || !videoUrl) return;
  try {
    const raw = localStorage.getItem(LAWYERS_ONBOARDING_VIDEO_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[userKey] = videoUrl;
    localStorage.setItem(LAWYERS_ONBOARDING_VIDEO_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
