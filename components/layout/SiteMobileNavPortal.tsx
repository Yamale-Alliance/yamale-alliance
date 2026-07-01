"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Renders mobile nav overlays on document.body so sticky header chrome cannot clip them. */
export function SiteMobileNavPortal({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;
  return createPortal(children, document.body);
}

export const siteMobileNavBackdropClass =
  "fixed inset-0 z-[120] bg-black/50 backdrop-blur-[1px] lg:hidden";

export const siteMobileNavDrawerClass =
  "fixed right-0 top-0 z-[121] flex h-[100dvh] w-72 max-w-[85vw] flex-col border-l border-border bg-background pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] shadow-2xl lg:hidden";
