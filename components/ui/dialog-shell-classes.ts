/** Scrollable viewport so tall dialogs sit below the sticky site header (72–88px). */
export const dialogScrollViewportClass = "fixed inset-0 overflow-y-auto overscroll-contain";

export const dialogScrollViewportInnerClass =
  "flex min-h-full justify-center p-4 pt-[5.75rem] pb-8 sm:items-center sm:px-6 sm:py-8";

export const dialogPanelBaseClass =
  "relative my-auto flex w-full flex-col rounded-xl border border-border bg-card shadow-2xl focus:outline-none max-h-[min(720px,calc(100dvh-7rem))] sm:max-h-[min(720px,calc(100dvh-5rem))] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95";
