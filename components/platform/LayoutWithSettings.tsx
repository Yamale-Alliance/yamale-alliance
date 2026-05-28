import { Suspense } from "react";
import { CONTENT_PRICING_DEFAULTS } from "@/lib/content-pricing";
import { PlatformSettingsProvider } from "@/components/platform/PlatformSettingsContext";
import { PlatformSettingsStream } from "@/components/platform/PlatformSettingsStream";
import { LayoutShell } from "@/components/platform/LayoutShell";

export const EMPTY_PLATFORM_SETTINGS = {
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  heroImageUrl: null as string | null,
  founderPortraitUrl: null as string | null,
  lawyersOnboardingVideoUrl: null as string | null,
  ...CONTENT_PRICING_DEFAULTS,
};

/** Layout shell streams immediately; branding/pricing hydrate via Suspense (faster LCP). */
export function LayoutWithSettings({ children }: { children: React.ReactNode }) {
  return (
    <PlatformSettingsProvider initial={EMPTY_PLATFORM_SETTINGS}>
      <LayoutShell>{children}</LayoutShell>
      <Suspense fallback={null}>
        <PlatformSettingsStream />
      </Suspense>
    </PlatformSettingsProvider>
  );
}

/** Same shell without waiting on settings (used if a parent Suspense boundary suspends). */
export function LayoutWithSettingsFallback({ children }: { children: React.ReactNode }) {
  return (
    <PlatformSettingsProvider initial={EMPTY_PLATFORM_SETTINGS}>
      <LayoutShell>{children}</LayoutShell>
    </PlatformSettingsProvider>
  );
}
