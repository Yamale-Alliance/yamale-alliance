"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Play, X } from "lucide-react";
import { cloudinaryVideoPlaybackUrl } from "@/lib/cloudinary-video-playback";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  onDismiss: () => void;
};

export function LawyersOnboardingVideoDialog({ open, onOpenChange, videoUrl, onDismiss }: Props) {
  const [loadError, setLoadError] = useState(false);
  const playbackSrc = useMemo(() => cloudinaryVideoPlaybackUrl(videoUrl), [videoUrl]);

  useEffect(() => {
    if (open) setLoadError(false);
  }, [open, playbackSrc]);

  const handleClose = () => {
    onDismiss();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/65 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[111] flex max-h-[min(92vh,calc(100%-2rem))] w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0 pe-2">
              <Dialog.Title className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                <Play className="h-5 w-5 text-primary" aria-hidden />
                Join Yamalé as a lawyer
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                A short walkthrough of how to join our platform, submit your profile, and get listed in the
                lawyer directory.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
                onClick={handleClose}
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 bg-black">
            {loadError ? (
              <p className="flex min-h-[200px] items-center justify-center px-6 py-8 text-center text-sm text-muted-foreground">
                The video could not be loaded. Try the onboarding video button again, or contact support if this
                continues.
              </p>
            ) : open ? (
              <video
                key={playbackSrc}
                src={playbackSrc}
                controls
                playsInline
                preload="auto"
                className="aspect-video max-h-[min(60vh,520px)] w-full bg-black object-contain"
                onLoadedData={() => setLoadError(false)}
                onError={() => setLoadError(true)}
              />
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end border-t border-border bg-muted/40 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center justify-center rounded-lg bg-[#0D1B2A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#162436] dark:bg-primary dark:text-primary-foreground"
            >
              Got it
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
