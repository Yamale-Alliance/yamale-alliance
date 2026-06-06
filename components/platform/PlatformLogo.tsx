"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { usePlatformSettings } from "@/components/platform/PlatformSettingsContext";
import { useTheme } from "@/components/theme/ThemeProvider";

const CACHE_KEY = "yamale-platform-logo-url";

function readCachedLogo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

function writeCachedLogo(url: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (url) sessionStorage.setItem(CACHE_KEY, url);
    else sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

interface PlatformLogoProps {
  className?: string;
  height?: number;
  width?: number;
  fallback?: string;
  /** Above-the-fold header logo — sets loading="eager" for LCP. */
  priority?: boolean;
}

export function PlatformLogo({
  className = "",
  height = 44,
  width = 160,
  fallback = "Yamalé",
  priority = false,
}: PlatformLogoProps) {
  const { logoUrl: settingsLogoUrl } = usePlatformSettings();
  const { theme } = useTheme();
  const [hydrated, setHydrated] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(settingsLogoUrl);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (settingsLogoUrl) {
      writeCachedLogo(settingsLogoUrl);
      setLogoUrl(settingsLogoUrl);
      return;
    }

    if (!hydrated) return;

    const cached = readCachedLogo();
    if (cached) {
      setLogoUrl(cached);
      return;
    }

    const id =
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback(
            () => {
              fetch("/api/admin/platform-settings")
                .then((res) => res.json())
                .then((data: { logoUrl?: string | null }) => {
                  const url = data.logoUrl || null;
                  writeCachedLogo(url);
                  setLogoUrl(url);
                })
                .catch(() => setLogoUrl(readCachedLogo()));
            },
            { timeout: 2000 }
          )
        : window.setTimeout(() => {
            fetch("/api/admin/platform-settings")
              .then((res) => res.json())
              .then((data: { logoUrl?: string | null }) => {
                const url = data.logoUrl || null;
                writeCachedLogo(url);
                setLogoUrl(url);
              })
              .catch(() => setLogoUrl(readCachedLogo()));
          }, 500);

    return () => {
      if (typeof cancelIdleCallback !== "undefined" && typeof id === "number") {
        cancelIdleCallback(id);
      } else if (typeof id === "number") {
        clearTimeout(id);
      }
    };
  }, [settingsLogoUrl, hydrated]);

  const displayUrl = hydrated ? (settingsLogoUrl ?? logoUrl) : settingsLogoUrl;

  const isSvgLogo =
    displayUrl && (/\.svg(?:$|[?#])/i.test(displayUrl) || displayUrl.includes("image/svg+xml"));
  const darkSvgStyle =
    theme === "dark" && isSvgLogo
      ? ({
          mixBlendMode: "multiply",
        } as const)
      : undefined;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-start overflow-hidden ${className}`}
      style={{ height: `${height}px`, width: `${width}px`, maxWidth: "100%" }}
    >
      {displayUrl ? (
        <Image
          src={displayUrl}
          alt="Platform logo"
          height={height}
          width={width}
          priority={priority}
          className="max-h-full w-auto max-w-full"
          style={{ objectFit: "contain", height: `${height}px`, width: "auto", ...darkSvgStyle }}
          unoptimized
        />
      ) : (
        <span
          className="truncate font-semibold tracking-tight text-foreground"
          style={{ fontSize: Math.max(14, Math.round(height * 0.38)) }}
        >
          {fallback}
        </span>
      )}
    </span>
  );
}
