"use client";

import { createContext, useContext, type ReactNode } from "react";
import { CONTENT_PRICING_DEFAULTS, type ContentPricingSnapshot } from "@/lib/content-pricing";

export type PlatformSettings = {
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
  founderPortraitUrl: string | null;
  lawyersOnboardingVideoUrl: string | null;
} & ContentPricingSnapshot;

const defaultSettings: PlatformSettings = {
  logoUrl: null,
  faviconUrl: null,
  heroImageUrl: null,
  founderPortraitUrl: null,
  lawyersOnboardingVideoUrl: null,
  ...CONTENT_PRICING_DEFAULTS,
};

const PlatformSettingsContext = createContext<PlatformSettings>(defaultSettings);

export function PlatformSettingsProvider({
  initial,
  children,
}: {
  initial: PlatformSettings;
  children: ReactNode;
}) {
  return (
    <PlatformSettingsContext.Provider value={initial}>
      {children}
    </PlatformSettingsContext.Provider>
  );
}

export function usePlatformSettings(): PlatformSettings {
  return useContext(PlatformSettingsContext);
}
