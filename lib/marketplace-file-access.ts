export type MarketplaceFileAccessMeta = {
  language_code: string;
  file_name: string;
  file_format: string;
};

/** Fetch a signed URL for a marketplace item file (view or download). */
export async function fetchMarketplaceFileUrl(
  itemId: string,
  languageCode?: string | null
): Promise<{
  url: string;
  file_name: string | null;
  file_format?: string | null;
  language_code?: string | null;
}> {
  const qs = languageCode?.trim() ? `?lang=${encodeURIComponent(languageCode.trim())}` : "";
  const res = await fetch(`/api/marketplace/${itemId}/download${qs}`, { credentials: "include" });
  const data = (await res.json()) as {
    url?: string;
    file_name?: string | null;
    file_format?: string | null;
    language_code?: string | null;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Could not get file");
  if (!data.url) throw new Error("Could not get file");
  return {
    url: data.url,
    file_name: data.file_name ?? null,
    file_format: data.file_format ?? null,
    language_code: data.language_code ?? languageCode ?? null,
  };
}

/** Save a file to the user's device (blob when possible, otherwise open signed URL). */
export async function saveMarketplaceFile(url: string, fileName: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export function defaultMarketplaceDownloadName(
  fileName: string | null | undefined,
  fileFormat: string | null | undefined
): string {
  if (fileName?.trim()) return fileName.trim();
  const fmt = fileFormat?.replace(/^\./, "") ?? "pdf";
  return `download.${fmt}`;
}
