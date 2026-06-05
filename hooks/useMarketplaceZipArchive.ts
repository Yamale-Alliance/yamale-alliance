"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type JSZip from "jszip";

const MAX_ZIP_BYTES = 150 * 1024 * 1024;

export function useMarketplaceZipArchive(itemId: string | null) {
  const zipRef = useRef<JSZip | null>(null);
  const [zip, setZip] = useState<JSZip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveTitle, setArchiveTitle] = useState("Package.zip");

  const load = useCallback(async () => {
    if (!itemId) {
      zipRef.current = null;
      setZip(null);
      return;
    }

    setLoading(true);
    setError(null);
    zipRef.current = null;
    setZip(null);

    try {
      const res = await fetch(`/api/marketplace/${itemId}/zip-archive`, { credentials: "include" });
      const cd = res.headers.get("content-disposition");
      const star = /filename\*=UTF-8''([^;]+)/i.exec(cd ?? "");
      if (star?.[1]) {
        try {
          setArchiveTitle(decodeURIComponent(star[1].trim()));
        } catch {
          setArchiveTitle(star[1].trim());
        }
      }

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? "Could not load package");
        return;
      }

      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_ZIP_BYTES) {
        setError("ZIP is too large to open in the workspace.");
        return;
      }

      const { default: JSZipCtor } = await import("jszip");
      const loaded = await JSZipCtor.loadAsync(ab);
      zipRef.current = loaded;
      setZip(loaded);
    } catch {
      setError("Something went wrong loading the package");
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void load();
    return () => {
      zipRef.current = null;
      setZip(null);
    };
  }, [load]);

  return { zip, loading, error, archiveTitle, reload: load };
}
