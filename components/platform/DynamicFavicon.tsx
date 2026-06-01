"use client";

import { useEffect } from "react";
import { usePlatformSettings } from "@/components/platform/PlatformSettingsContext";

const FAVICON_ID = "yamale-dynamic-favicon";

/**
 * Updates a single favicon link we own. Do not remove other <link rel="icon"> nodes —
 * Next metadata injects those and React will throw on removeChild if we delete them.
 */
function applyFavicon(href: string, type = "image/x-icon") {
  if (typeof document === "undefined" || !document.head) return;

  let link = document.getElementById(FAVICON_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = FAVICON_ID;
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = type;
  link.href = href;
}

/** Tab icon: Cloudinary URL when settings hydrate, else same-origin /favicon.ico. */
export function DynamicFavicon() {
  const { faviconUrl } = usePlatformSettings();

  useEffect(() => {
    const trimmed = faviconUrl?.trim();
    if (trimmed) {
      const type = trimmed.toLowerCase().includes(".ico") ? "image/x-icon" : "image/png";
      applyFavicon(trimmed, type);
      return;
    }
    applyFavicon("/favicon.ico", "image/x-icon");
  }, [faviconUrl]);

  return null;
}
