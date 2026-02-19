import { getPlatformSettings } from "@/lib/platform-settings";
import { Header } from "@/components/layout/Header";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { DynamicFavicon } from "@/components/platform/DynamicFavicon";
import { PlatformSettingsProvider } from "@/components/platform/PlatformSettingsContext";
import { OfflineProvider } from "@/components/offline/OfflineProvider";

/** Server component: fetches platform settings and renders layout with logo/favicon/hero in context. */
export async function LayoutWithSettings({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getPlatformSettings();
  const initial = {
    logoUrl: settings.logoUrl ?? null,
    faviconUrl: settings.faviconUrl ?? null,
    heroImageUrl: settings.heroImageUrl ?? null,
  };

  return (
    <PlatformSettingsProvider initial={initial}>
      <DynamicFavicon />
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex-1">{children}</div>
        <ConditionalFooter />
      </div>
      <OfflineProvider />
    </PlatformSettingsProvider>
  );
}

const EMPTY_INITIAL = {
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  heroImageUrl: null as string | null,
};

/** Fallback when settings are still loading — same layout with null so client can show "Yamalé" / default favicon. */
export function LayoutWithSettingsFallback({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlatformSettingsProvider initial={EMPTY_INITIAL}>
      <DynamicFavicon />
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex-1">{children}</div>
        <ConditionalFooter />
      </div>
      <OfflineProvider />
    </PlatformSettingsProvider>
  );
}
