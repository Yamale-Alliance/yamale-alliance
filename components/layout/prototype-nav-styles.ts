/** Yamalé prototype (yamale_prototype.html) — shared nav chrome classes. */

export const prototypeNavHeaderClass =
  "sticky top-0 z-50 border-b border-border bg-card shadow-[0_1px_3px_rgba(13,27,42,0.06),0_1px_2px_rgba(13,27,42,0.04)]";

export const prototypeNavInnerClass =
  "mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-2 px-4 sm:h-[88px] sm:px-8";

export function prototypeNavLinkClass(active: boolean): string {
  return [
    "rounded-[6px] px-[14px] py-2 text-[13.5px] font-medium transition-colors",
    active ? "font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  ].join(" ");
}

/** Primary CTA in prototype nav — navy button (gold on dark theme). */
export const prototypeNavSignUpClass =
  "inline-flex items-center justify-center rounded-[6px] bg-[#0D1B2A] px-[18px] py-2 text-[13.5px] font-semibold text-white transition hover:bg-[#162436] dark:bg-primary dark:text-[#0D1B2A] dark:hover:bg-primary/90";

export const prototypeNavGhostClass =
  "inline-flex items-center justify-center rounded-[6px] border border-border px-4 py-2 text-[13.5px] font-medium text-muted-foreground transition hover:border-muted-foreground hover:text-foreground";
