"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LAW_PRINT_PRICE_USD_CENTS } from "@/lib/law-print-pricing";

export type PlatformSettings = {
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
  /** Pay-as-you-go law PDF unlock list price (USD cents). */
  lawPrintPriceUsdCents: number;
};

const defaultSettings: PlatformSettings = {
  logoUrl: null,
  faviconUrl: null,
  heroImageUrl: null,
  lawPrintPriceUsdCents: DEFAULT_LAW_PRINT_PRICE_USD_CENTS,
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
