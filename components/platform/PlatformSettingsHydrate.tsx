"use client";

import { useContext, useEffect } from "react";
import {
  PlatformSettingsSetterContext,
  type PlatformSettings,
} from "@/components/platform/PlatformSettingsContext";

/** Applies server-fetched branding/pricing after the shell has streamed (non-blocking LCP). */
export function PlatformSettingsHydrate({ settings }: { settings: PlatformSettings }) {
  const setSettings = useContext(PlatformSettingsSetterContext);
  useEffect(() => {
    setSettings?.(settings);
  }, [settings, setSettings]);
  return null;
}
