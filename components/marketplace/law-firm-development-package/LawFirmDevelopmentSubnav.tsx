"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Height of the fixed sub-nav bar (spacer in document flow). */
export const LAW_FIRM_SUBNAV_HEIGHT_CLASS = "h-[var(--vault-chrome-h)]";

/**
 * Package sub-nav portaled to document.body with fixed top = site header height.
 * Offset is CSS-only (never updated on scroll) so the bar cannot drift while scrolling.
 */
export function LawFirmDevelopmentSubnav({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const bar = (
    <nav
      className="law-firm-package-subnav fixed left-0 right-0 flex w-full items-center justify-between border-b border-[rgba(193,140,67,0.2)] bg-[rgba(34,25,19,0.97)] px-4 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.35)] sm:px-8 sm:py-5"
      aria-label="Law Firm Development Package"
    >
      {children}
    </nav>
  );

  return (
    <>
      <div className={LAW_FIRM_SUBNAV_HEIGHT_CLASS} aria-hidden />
      {mounted ? createPortal(bar, document.body) : null}
    </>
  );
}
