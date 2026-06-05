"use client";

import { useCallback, useEffect, useState } from "react";
import type JSZip from "jszip";
import {
  buildZipEntryPreview,
  resolveZipEntryPath,
  revokeZipPreviewUrls,
  type ZipEntryPreviewState,
} from "@/lib/marketplace-zip-preview";

export function useZipEntryPreview(zip: JSZip | null, sourcePath: string) {
  const [preview, setPreview] = useState<ZipEntryPreviewState>({ kind: "idle" });

  const reload = useCallback(async () => {
    if (!zip || !sourcePath.trim()) return;

    const resolved = resolveZipEntryPath(zip, sourcePath);
    if (!resolved) {
      setPreview({
        kind: "error",
        path: sourcePath,
        message: `File not found in package: ${sourcePath}`,
      });
      return;
    }

    setPreview((prev) => {
      revokeZipPreviewUrls(prev);
      return { kind: "loading", path: resolved };
    });
    const next = await buildZipEntryPreview(zip, resolved);
    setPreview(next);
  }, [zip, sourcePath]);

  useEffect(() => {
    if (!zip) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when zip ready
  }, [zip, sourcePath]);

  useEffect(() => {
    return () => revokeZipPreviewUrls(preview);
  }, [preview]);

  return { preview, reload, resolvedPath: preview.kind !== "idle" ? preview.path : null };
}
