"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Phase = "scan" | "upload";

function useVirusScanUploadPhase(active: boolean): Phase | null {
  const [phase, setPhase] = useState<Phase>("scan");

  useEffect(() => {
    if (!active) return;
    setPhase("scan");
    const timer = window.setTimeout(() => setPhase("upload"), 2500);
    return () => window.clearTimeout(timer);
  }, [active]);

  return active ? phase : null;
}

function phaseCopy(phase: Phase): { title: string; hint: string } {
  if (phase === "scan") {
    return {
      title: "Scanning for viruses…",
      hint: "Checking file with VirusTotal before storage.",
    };
  }
  return {
    title: "Scanning & uploading…",
    hint: "New files can take up to 2 minutes. Please keep this tab open.",
  };
}

/** Live status text for upload buttons during VirusTotal + storage. */
export function useVirusScanUploadStatus(active: boolean) {
  const phase = useVirusScanUploadPhase(active);
  if (!phase) return null;
  return phaseCopy(phase);
}

type BannerProps = {
  active: boolean;
  fileName?: string | null;
  className?: string;
};

export function AdminVirusScanUploadBanner({ active, fileName, className = "" }: BannerProps) {
  const status = useVirusScanUploadStatus(active);
  if (!status) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm ${className}`}
    >
      <Loader2
        className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-700 dark:text-amber-400"
        aria-hidden
      />
      <div className="min-w-0">
        <p className="font-medium text-amber-950 dark:text-amber-100">{status.title}</p>
        <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
          {fileName ? (
            <>
              <span className="font-medium">{fileName}</span>
              {" · "}
            </>
          ) : null}
          {status.hint}
        </p>
      </div>
    </div>
  );
}
