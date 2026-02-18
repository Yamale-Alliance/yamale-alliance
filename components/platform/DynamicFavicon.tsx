"use client";

import { useEffect, useRef } from "react";
import { usePlatformSettings } from "@/components/platform/PlatformSettingsContext";

const FAVICON_ID = "yamale-dynamic-favicon";

export function DynamicFavicon() {
  const { faviconUrl: initialFaviconUrl } = usePlatformSettings();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (initialFaviconUrl) {
      if (typeof document === "undefined" || !document.head) return;
      try {
        const existing = document.getElementById(FAVICON_ID);
        if (existing && existing.parentNode) {
          existing.parentNode.removeChild(existing);
        }
        const link = document.createElement("link");
        link.id = FAVICON_ID;
        link.rel = "icon";
        link.type = "image/x-icon";
        link.href = initialFaviconUrl;
        document.head.appendChild(link);
      } catch {
        // Ignore DOM errors
      }
      return;
    }

    // Defer so library and main content load first
    const run = () => {
      const controller = new AbortController();
      fetch("/api/admin/platform-settings", { signal: controller.signal })
      .then((res) => res.json())
      .then((data: { faviconUrl?: string | null }) => {
        if (!mountedRef.current || !data.faviconUrl) return;
        if (typeof document === "undefined" || !document.head) return;
        try {
          const existing = document.getElementById(FAVICON_ID);
          if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
          }
          const link = document.createElement("link");
          link.id = FAVICON_ID;
          link.rel = "icon";
          link.type = "image/x-icon";
          link.href = data.faviconUrl;
          document.head.appendChild(link);
        } catch {
          // Ignore DOM errors
        }
      })
      .catch(() => {});

      return () => {
        mountedRef.current = false;
        controller.abort();
      };
    };

    const id =
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback(run, { timeout: 2000 })
        : setTimeout(run, 500);

    return () => {
      mountedRef.current = false;
      if (typeof cancelIdleCallback !== "undefined" && typeof id === "number") {
        cancelIdleCallback(id);
      } else if (typeof id === "number") {
        clearTimeout(id);
      }
    };
  }, [initialFaviconUrl]);

  return null;
}
