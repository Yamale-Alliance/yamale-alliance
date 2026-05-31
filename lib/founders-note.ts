/** Bump when the note copy changes materially — triggers a new one-time prompt. */
export const FOUNDERS_NOTE_VERSION = "v1";

export const FOUNDERS_NOTE_STORAGE_KEY = `yamale-founders-note:${FOUNDERS_NOTE_VERSION}`;

export const FOUNDERS_NOTE_METADATA_KEY = `founders_note_seen_${FOUNDERS_NOTE_VERSION}`;

export type FoundersNoteContent = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  signature: {
    name: string;
    title: string;
    location: string;
  };
};

export const FOUNDERS_NOTE: FoundersNoteContent = {
  eyebrow: "Founder's note",
  title: "Why We Built Yamalé",
  paragraphs: [
    "For all the years I have worked across Africa, with governments, with businesses, with communities navigating some of the continent's most complex legal and governance challenges, the problem was always the same. The law was everywhere and nowhere at once.",
    "Companies spent weeks hunting down investment codes. Lawyers kept personal PDF libraries because no reliable central source existed. Critical laws sat only in outdated paper gazettes or on broken ministry websites. When we needed a specific article of an OHADA Uniform Act, or had to check whether a mining permit complied with national law, we lost hours, sometimes days, just finding and confirming the text.",
    "The cost was never only in lost time. It was a barrier to investment, to compliance, to accountability, and to the cross-border trade that the African Continental Free Trade Area promises but cannot deliver without functioning legal infrastructure.",
    "In January 2026, we built Yamalé. It is a nonprofit and a platform working together. The nonprofit continues the advisory work we have always done, supporting governments in high-stakes negotiations, helping mining communities protect their rights, and strengthening institutions. The platform builds the infrastructure that work depends on: a comprehensive, AI-powered legal library covering all 54 African countries, tools for AfCFTA compliance, and a marketplace for specialized legal expertise.",
    "Yamalé is a community platform, and we want to be honest with you from day one about where it stands. We have laws for every African country, though some are still being cleaned up from old scanned documents. The Vault of expert content for sale is modest at launch and will grow steadily. The directory of vetted lawyers is invitation-only for now, by design, as we build it with care. The AfCFTA Passport, our step-by-step compliance tool for cross-border trade, is still in development and will launch later this year.",
    "We are launching now because a resource that grows alongside its users is worth far more than one perfected in private and delivered too late. The current alternative, scattered and often unreliable legal information, is not serving anyone well enough.",
    "This platform will only work if we are honest with each other. We are telling you what is ready and what is not, and we are asking you to do the same in return. The people best placed to make Yamalé stronger are the ones who will use it every day. If something needs fixing, please tell us. If a law you rely on is missing, submit it. If a document is wrong or out of date, flag it. If you are a lawyer or legal expert who wants to contribute, apply to join our network. Every correction, every contribution, and every honest piece of feedback shapes what this platform becomes.",
    "Yamalé exists because African businesses, governments, and legal professionals deserve the same access to legal infrastructure that people in other regions take for granted. We are building it together, and we hope you will help us build it well.",
  ],
  signature: {
    name: "Meghan Waters",
    title: "Chief Executive Officer, Yamalé",
    location: "Dakar, Senegal · June 2026",
  },
};

/** Routes where the one-time welcome dialog should not auto-open. */
export function shouldSkipFoundersNoteAutoPrompt(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname.startsWith("/founders-note")) return true;
  if (pathname.startsWith("/admin-panel")) return true;
  if (pathname.startsWith("/ai-research")) return true;
  if (pathname.startsWith("/library")) return true;
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
