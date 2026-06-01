"use client";

import { useEffect } from "react";
import { usePlatformSettings } from "@/components/platform/PlatformSettingsContext";

const FAVICON_ID = "yamale-dynamic-favicon";

function applyFavicon(href: string, type = "image/x-icon") {
  if (typeof document === "undefined" || !document.head) return;

  document
    .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
    .forEach((node) => {
      if (node.id !== FAVICON_ID) node.remove();
    });

  let link = document.getElementById(FAVICON_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = FAVICON_ID;
    document.head.appendChild(link);
  }
  link.rel = "icon";
  link.type = type;
  link.href = href;
}

/** Tab icon: Cloudinary URL when set, else same-origin /favicon.ico from admin branding. */
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
