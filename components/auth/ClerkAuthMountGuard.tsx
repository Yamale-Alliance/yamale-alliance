"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type ClerkAuthMountGuardProps = {
  children: ReactNode;
  mode: "sign-in" | "sign-up";
};

/** Detects when Clerk auth UI failed to mount (ad blockers, CSP, CSS conflicts). */
export function ClerkAuthMountGuard({ children, mode }: ClerkAuthMountGuardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const deadline = window.setTimeout(() => {
      const root = rootRef.current;
      if (!root) return;
      const hasInteractiveUi = root.querySelector(
        'input, button[type="submit"], [data-localization-key], .cl-socialButtons, .cl-formButtonPrimary'
      );
      if (!hasInteractiveUi) setShowHelp(true);
    }, 5000);
    return () => window.clearTimeout(deadline);
  }, []);

  const label = mode === "sign-in" ? "Sign in" : "Sign up";

  return (
    <div ref={rootRef} className="min-h-[12rem] w-full">
      {children}
      {showHelp ? (
        <div
          className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
          role="alert"
        >
          <p className="font-medium">{label} form did not load.</p>
          <p className="mt-1 text-muted-foreground">
            Try a hard refresh, disable ad blockers or privacy extensions for this site, or use
            another browser (Chrome or Edge). If it still fails, contact{" "}
            <a href="mailto:support@yamalelegal.com" className="text-primary hover:underline">
              support@yamalelegal.com
            </a>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
