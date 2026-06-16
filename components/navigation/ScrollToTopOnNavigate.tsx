"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Reset window scroll when navigating to a different pathname.
 * Query-only updates (marketplace/library filters) keep scroll position.
 */
export function ScrollToTopOnNavigate() {
  const pathname = usePathname();
  const previousPathname = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    const previous = previousPathname.current;
    previousPathname.current = pathname;

    if (previous === undefined || previous === pathname) return;
    if (window.location.hash) return;

    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
