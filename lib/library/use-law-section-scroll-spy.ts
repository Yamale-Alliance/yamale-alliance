import { useEffect, useState } from "react";

const SCROLL_OFFSET_PX = 120;

/**
 * Highlight the TOC entry for the section nearest the top of the viewport while scrolling.
 */
export function useLawSectionScrollSpy(
  sectionIds: string[],
  enabled: boolean
): string {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? "");

  useEffect(() => {
    if (!enabled || sectionIds.length === 0) return;

    const syncActive = () => {
      let current = sectionIds[0]!;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= SCROLL_OFFSET_PX) {
          current = id;
        }
      }
      setActiveId((prev) => (prev === current ? prev : current));
    };

    syncActive();
    window.addEventListener("scroll", syncActive, { passive: true });
    window.addEventListener("resize", syncActive);
    return () => {
      window.removeEventListener("scroll", syncActive);
      window.removeEventListener("resize", syncActive);
    };
  }, [enabled, sectionIds]);

  useEffect(() => {
    if (sectionIds.length === 0) return;
    setActiveId((prev) => (sectionIds.includes(prev) ? prev : sectionIds[0]!));
  }, [sectionIds]);

  return activeId;
}
