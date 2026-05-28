import { getPlatformSettings } from "@/lib/platform-settings";
import { PlatformSettingsHydrate } from "@/components/platform/PlatformSettingsHydrate";
import type { PlatformSettings } from "@/components/platform/PlatformSettingsContext";

async function loadPlatformSettings(): Promise<PlatformSettings> {
  const settings = await getPlatformSettings();
  return {
    logoUrl: settings.logoUrl ?? null,
    faviconUrl: settings.faviconUrl ?? null,
    heroImageUrl: settings.heroImageUrl ?? null,
    founderPortraitUrl: settings.founderPortraitUrl ?? null,
    lawyersOnboardingVideoUrl: settings.lawyersOnboardingVideoUrl ?? null,
    lawPrintPriceUsdCents: settings.lawPrintPriceUsdCents,
    dayPassPriceUsdCents: settings.dayPassPriceUsdCents,
    lawyerSearchUnlockPriceUsdCents: settings.lawyerSearchUnlockPriceUsdCents,
    aiQueryPriceUsdCents: settings.aiQueryPriceUsdCents,
    afcftaReportPriceUsdCents: settings.afcftaReportPriceUsdCents,
  };
}

/** Fetches platform settings in a Suspense boundary so page content can paint first. */
export async function PlatformSettingsStream() {
  const settings = await loadPlatformSettings();
  return <PlatformSettingsHydrate settings={settings} />;
}
