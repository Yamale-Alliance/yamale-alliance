"use client";

import { createContext, useContext, type ReactNode } from "react";

export type PlatformSettings = {
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
};

const defaultSettings: PlatformSettings = {
  logoUrl: null,
  faviconUrl: null,
  heroImageUrl: null,
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
