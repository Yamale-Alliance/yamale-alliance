"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
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

export const PlatformSettingsSetterContext = createContext<
  ((settings: PlatformSettings) => void) | null
>(null);

export function PlatformSettingsProvider({
  initial,
  children,
}: {
  initial: PlatformSettings;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState(initial);
  return (
    <PlatformSettingsSetterContext.Provider value={setSettings}>
      <PlatformSettingsContext.Provider value={settings}>
        {children}
      </PlatformSettingsContext.Provider>
    </PlatformSettingsSetterContext.Provider>
  );
}

export function usePlatformSettings(): PlatformSettings {
  return useContext(PlatformSettingsContext);
}
