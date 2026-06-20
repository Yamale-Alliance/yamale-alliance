"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Clears stuck Radix / modal scroll locks after navigation (can block input focus on mobile). */
export function MobileScrollLockCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("pointer-events");
    document.body.style.removeProperty("padding-right");
    document.body.removeAttribute("data-scroll-locked");
  }, [pathname]);

  return null;
}
