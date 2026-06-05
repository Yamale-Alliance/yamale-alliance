"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { usePathname } from "next/navigation";
import { Play } from "lucide-react";
import { usePlatformSettings } from "@/components/platform/PlatformSettingsContext";
import {
  readLawyersOnboardingSeenFromStorage,
  shouldAutoPromptLawyersOnboardingVideo,
  writeLawyersOnboardingSeenToStorage,
} from "@/lib/lawyers-onboarding-video";
import { LawyersOnboardingVideoDialog } from "@/components/lawyers/LawyersOnboardingVideoDialog";

function storageKeyForUser(userId: string | null | undefined): string {
  return userId ?? "guest";
}

type Props = {
  /** Render the replay control (hero button). */
  showReplayButton?: boolean;
  className?: string;
};

export function LawyersOnboardingVideo({ showReplayButton = true, className }: Props) {
  const { lawyersOnboardingVideoUrl } = usePlatformSettings();
  const { user, isLoaded } = useAppUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const markedSeenRef = useRef(false);

  const videoUrl = lawyersOnboardingVideoUrl?.trim() || "";
  const autoPrompt = shouldAutoPromptLawyersOnboardingVideo(pathname);

  const markSeen = useCallback(async () => {
    if (!videoUrl || markedSeenRef.current) return;
    markedSeenRef.current = true;
    const key = storageKeyForUser(user?.id);
    writeLawyersOnboardingSeenToStorage(key, videoUrl);
    if (user?.id) {
      try {
        await fetch("/api/user/lawyers-onboarding-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ videoUrl }),
        });
      } catch {
        // localStorage is enough for UX
      }
    }
  }, [user?.id, videoUrl]);

  useEffect(() => {
    if (!isLoaded || checked || !videoUrl) return;

    if (!autoPrompt) {
      setChecked(true);
      return;
    }

    const key = storageKeyForUser(user?.id);
    if (readLawyersOnboardingSeenFromStorage(key, videoUrl)) {
      setChecked(true);
      return;
    }

    let cancelled = false;

    const run = async () => {
      if (user?.id) {
        try {
          const res = await fetch("/api/user/lawyers-onboarding-video", { credentials: "include" });
          if (res.ok) {
            const data = (await res.json()) as { seen?: boolean; videoUrl?: string | null };
            if (data.seen && data.videoUrl === videoUrl) {
              writeLawyersOnboardingSeenToStorage(key, videoUrl);
              if (!cancelled) setChecked(true);
              return;
            }
          }
        } catch {
          // fall through to show dialog
        }
      }
      if (!cancelled) {
        setOpen(true);
        setChecked(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, checked, user?.id, videoUrl, autoPrompt]);

  if (!videoUrl) return null;

  return (
    <>
      {showReplayButton && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            className ??
            "inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          }
        >
          <Play className="h-4 w-4 shrink-0" aria-hidden />
          Onboarding video
        </button>
      )}
      <LawyersOnboardingVideoDialog
        open={open}
        onOpenChange={setOpen}
        videoUrl={videoUrl}
        onDismiss={() => void markSeen()}
      />
    </>
  );
}
