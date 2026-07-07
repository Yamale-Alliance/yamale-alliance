/** Admin main scroll container (see app/(admin)/layout.tsx). */
export function getAdminWorkspaceMain(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".admin-workspace-main");
}

export function clampAdminWorkspaceMainScroll(): void {
  const main = getAdminWorkspaceMain();
  if (!main) return;
  const maxScroll = Math.max(0, main.scrollHeight - main.clientHeight);
  if (main.scrollTop > maxScroll) {
    main.scrollTop = maxScroll;
  }
}

/** Keep scroll position stable across native file-picker focus jumps. */
export function preserveAdminWorkspaceMainScroll(run: () => void): void {
  const main = getAdminWorkspaceMain();
  const scrollTop = main?.scrollTop ?? 0;
  run();
  requestAnimationFrame(() => {
    if (main) main.scrollTop = scrollTop;
    clampAdminWorkspaceMainScroll();
  });
}
