"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { AiResearchPricingPanel } from "@/components/ai-research/AiResearchPricingPanel";
import { AiResearchLaunchIcon } from "@/components/icons/AiResearchLaunchIcon";
import { siteModalPanelMaxHeightClass } from "@/components/layout/prototype-nav-styles";
import { hasAiResearchLaunchAccess } from "@/lib/ai-research-access";

export function LibraryAiResearchFab() {
  const t = useTranslations("library.aiFab");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAppUser();
  const [loading, setLoading] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  const onLaunch = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setPricingOpen(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/usage", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        tier?: string;
        canQuery?: boolean;
        payAsYouGoCount?: number;
      };
      if (hasAiResearchLaunchAccess(data)) {
        router.push("/ai-research");
        return;
      }
      setPricingOpen(true);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <>
      <div
        className="pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-[107] flex justify-end print:hidden sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))] sm:right-6"
        aria-live="polite"
      >
        <button
          type="button"
          onClick={onLaunch}
          disabled={loading || !isLoaded}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#C8922A]/30 bg-gradient-to-r from-[#9a632a] to-[#c8922a] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_36px_rgba(13,27,42,0.28)] ring-2 ring-white/90 transition hover:brightness-105 disabled:opacity-70 dark:ring-white/10"
          aria-label={t("launch")}
        >
          <AiResearchLaunchIcon className="h-5 w-5 shrink-0" />
          <span className="hidden sm:inline">{t("label")}</span>
        </button>
      </div>

      <Dialog.Root open={pricingOpen} onOpenChange={setPricingOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className={`fixed left-1/2 top-[calc(var(--site-nav-h,4.5rem)+0.75rem)] z-[101] flex w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl focus:outline-none sm:top-[calc(var(--site-nav-h,4.5rem)+1rem)] sm:w-[calc(100%-2rem)] ${siteModalPanelMaxHeightClass} data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95`}>
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0 pr-2">
                <Dialog.Title className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {t("dialogTitle")}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {t("dialogBody")}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={tCommon("close")}
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
              <AiResearchPricingPanel compact />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
