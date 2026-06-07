/** Yamalé prototype (yamale_prototype.html) — shared nav chrome classes. */

export const prototypeNavHeaderClass =
  "sticky top-0 z-50 border-b border-border bg-card shadow-[0_1px_3px_rgba(13,27,42,0.06),0_1px_2px_rgba(13,27,42,0.04)] print:hidden";

export const prototypeNavInnerClass =
  "mx-auto grid h-[72px] max-w-[1280px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 px-4 sm:h-[88px] sm:px-8 xl:gap-x-4";

/** Desktop nav row — centered in the middle grid column; scrolls instead of wrapping when space is tight. */
export const prototypeNavLinksRowClass =
  "hidden min-w-0 flex-nowrap items-center justify-self-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] lg:flex xl:gap-1 [&::-webkit-scrollbar]:hidden";

/** Right-side utilities (language, theme, auth / avatar). */
export const prototypeNavActionsClass =
  "flex shrink-0 flex-nowrap items-center justify-self-end gap-1 md:gap-1.5 xl:gap-2";

export function prototypeNavLinkClass(active: boolean): string {
  return [
    "shrink-0 whitespace-nowrap rounded-[6px] px-2 py-2 text-[13px] font-medium transition-colors xl:px-[14px] xl:text-[13.5px]",
    active ? "font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  ].join(" ");
}

/** Text-only sign-in (guest header) — lighter than bordered ghost to save horizontal space. */
export const prototypeNavSignInLinkClass =
  "shrink-0 whitespace-nowrap rounded-[6px] px-2 py-2 text-[13px] font-medium text-muted-foreground transition hover:text-foreground xl:px-3 xl:text-[13.5px]";

/** Primary CTA in prototype nav — navy button (gold on dark theme). */
export const prototypeNavSignUpClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[6px] bg-[#0D1B2A] px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#162436] dark:bg-primary dark:text-[#0D1B2A] dark:hover:bg-primary/90 xl:px-[18px] xl:py-2 xl:text-[13.5px]";

export const prototypeNavGhostClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[6px] border border-border px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition hover:border-muted-foreground hover:text-foreground xl:px-4 xl:py-2 xl:text-[13.5px]";
