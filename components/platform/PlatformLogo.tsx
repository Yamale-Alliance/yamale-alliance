"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { usePlatformSettings } from "@/components/platform/PlatformSettingsContext";
import { useTheme } from "@/components/theme/ThemeProvider";

// Cache logo URL so it persists across client-side navigations (avoids flash of "Yamalé" on route change)
let cachedLogoUrl: string | null = null;

const CACHE_KEY = "yamale-platform-logo-url";

function getCachedLogo(): string | null {
  if (typeof window === "undefined") return cachedLogoUrl;
  try {
    const stored = sessionStorage.getItem(CACHE_KEY);
    if (stored) return stored;
  } catch {}
  return cachedLogoUrl;
}

function setCachedLogo(url: string | null) {
  cachedLogoUrl = url;
  try {
    if (typeof window !== "undefined") {
      if (url) sessionStorage.setItem(CACHE_KEY, url);
      else sessionStorage.removeItem(CACHE_KEY);
    }
  } catch {}
}

interface PlatformLogoProps {
  className?: string;
  height?: number;
  width?: number;
  fallback?: string;
}

export function PlatformLogo({ className = "", height = 44, width = 160, fallback = "Yamalé" }: PlatformLogoProps) {
  const { logoUrl: initialLogoUrl } = usePlatformSettings();
  const { theme } = useTheme();
  const [logoUrl, setLogoUrl] = useState<string | null>(() => initialLogoUrl ?? getCachedLogo());
  const [loading, setLoading] = useState(() => !(initialLogoUrl ?? getCachedLogo()));

  useEffect(() => {
    const fromServer = initialLogoUrl ?? null;
    const cached = getCachedLogo();
    const effective = fromServer ?? cached;

    if (effective) {
      setCachedLogo(effective);
      setLogoUrl(effective);
      setLoading(false);
      return;
    }

    // Defer fetch until after page is interactive so library/navigation aren't blocked
    const id =
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback(() => {
            fetch("/api/admin/platform-settings")
              .then((res) => res.json())
              .then((data: { logoUrl?: string | null }) => {
                const url = data.logoUrl || null;
                setCachedLogo(url);
                setLogoUrl(url);
              })
              .catch(() => setLogoUrl(getCachedLogo()))
              .finally(() => setLoading(false));
          }, { timeout: 2000 })
        : setTimeout(() => {
            fetch("/api/admin/platform-settings")
              .then((res) => res.json())
              .then((data: { logoUrl?: string | null }) => {
                const url = data.logoUrl || null;
                setCachedLogo(url);
                setLogoUrl(url);
              })
              .catch(() => setLogoUrl(getCachedLogo()))
              .finally(() => setLoading(false));
          }, 500);

    return () => {
      if (typeof cancelIdleCallback !== "undefined" && typeof id === "number") {
        cancelIdleCallback(id);
      } else if (typeof id === "number") {
        clearTimeout(id);
      }
    };
  }, [initialLogoUrl]);

  if (loading && !logoUrl) {
    return <span className={className}>{fallback}</span>;
  }

  if (logoUrl) {
    const isSvgLogo = /\.svg(?:$|[?#])/i.test(logoUrl) || logoUrl.includes("image/svg+xml");
    const darkSvgStyle =
      theme === "dark" && isSvgLogo
        ? ({
            // Helps hide white SVG backgrounds on dark headers without editing the source file.
            mixBlendMode: "multiply",
          } as const)
        : undefined;

    return (
      <Image
        src={logoUrl}
        alt="Platform logo"
        height={height}
        width={width}
        className={className}
        style={{ objectFit: "contain", height: `${height}px`, width: "auto", ...darkSvgStyle }}
        unoptimized
      />
    );
  }

  return <span className={className}>{fallback}</span>;
}
