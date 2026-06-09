"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PLATFORM_TECHNICAL_EMAIL } from "@/lib/platform-emails";

type ClerkAuthMountGuardProps = {
  children: ReactNode;
  mode: "sign-in" | "sign-up";
};

/** Detects when Clerk auth UI failed to mount (ad blockers, CSP, CSS conflicts). */
export function ClerkAuthMountGuard({ children, mode }: ClerkAuthMountGuardProps) {
  const t = useTranslations("auth");
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

  return (
    <div ref={rootRef} className="min-h-[12rem] w-full">
      {children}
      {showHelp ? (
        <div
          className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
          role="alert"
        >
          <p className="font-medium">
            {mode === "sign-in" ? t("formDidNotLoadSignIn") : t("formDidNotLoadSignUp")}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t("formDidNotLoadHint")}{" "}
            <a
              href={`mailto:${PLATFORM_TECHNICAL_EMAIL}`}
              className="text-primary hover:underline"
            >
              {PLATFORM_TECHNICAL_EMAIL}
            </a>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
