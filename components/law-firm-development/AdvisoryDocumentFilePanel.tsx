"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useMarketplaceZipArchive } from "@/hooks/useMarketplaceZipArchive";
import { ZipEntryPreviewPane } from "@/components/marketplace/ZipEntryPreviewPane";
import {
  buildZipEntryPreview,
  displayZipEntryName,
  resolveZipEntryPath,
  revokeZipPreviewUrls,
  type ZipEntryPreviewState,
} from "@/lib/marketplace-zip-preview";

type Props = {
  marketplaceItemId: string;
  sourcePath: string;
};

export function AdvisoryDocumentFilePanel({ marketplaceItemId, sourcePath }: Props) {
  const { zip, loading, error } = useMarketplaceZipArchive(marketplaceItemId);
  const [preview, setPreview] = useState<ZipEntryPreviewState>({ kind: "idle" });

  const openSource = useCallback(async () => {
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

    setPreview({ kind: "loading", path: resolved });
    const next = await buildZipEntryPreview(zip, resolved);
    setPreview(next);
  }, [zip, sourcePath]);

  useEffect(() => {
    if (!zip) return;
    void openSource();
  }, [zip, openSource]);

  useEffect(() => {
    return () => revokeZipPreviewUrls(preview);
  }, [preview]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[rgba(193,140,67,0.15)] bg-[#221913] px-4 py-8">
        <Loader2 className="h-5 w-5 animate-spin text-[#C18C43]" />
        <span className="text-sm text-white/50">Loading package from your course…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-[rgba(193,140,67,0.15)] bg-[#221913] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(193,140,67,0.1)] pb-3">
        <p className="advisory-doc-editor__filename">
          Package file: <span className="text-[#9a632a]">{displayZipEntryName(sourcePath)}</span>
        </p>
        <button
          type="button"
          onClick={() => void openSource()}
          className="text-xs font-semibold uppercase tracking-wide text-[#C18C43] hover:text-[#E3BA65]"
        >
          Reload preview
        </button>
      </div>
      <div className="mt-4 min-h-[200px]">
        <ZipEntryPreviewPane preview={preview} />
      </div>
    </section>
  );
}
