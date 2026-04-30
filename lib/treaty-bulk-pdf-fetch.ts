/**
 * Download a URL for treaty bulk import. Validates size and that the payload looks like a PDF.
 */

const MAX_PDF_BYTES = 45 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 180_000;

export function bufferLooksLikePdf(buf: Buffer): boolean {
  if (buf.length < 5) return false;
  return buf.subarray(0, 5).toString("binary") === "%PDF-";
}

export type FetchPdfResult =
  | { ok: true; buffer: Buffer; contentType: string }
  | { ok: false; error: string };

export async function fetchPdfFromUrl(urlString: string): Promise<FetchPdfResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(urlString, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "YamaleAdminTreatyImport/1.0 (+https://yamale.com)",
        Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.1",
      },
    });

    if (!res.ok) {
      return { ok: false, error: `Download failed (${res.status} ${res.statusText})` };
    }

    const rawCt = res.headers.get("content-type") ?? "";
    const contentType = rawCt.split(";")[0]?.trim() ?? "";
    const lenHeader = res.headers.get("content-length");
    if (lenHeader) {
      const n = parseInt(lenHeader, 10);
      if (!Number.isNaN(n) && n > MAX_PDF_BYTES) {
        return {
          ok: false,
          error: `Remote file is too large (max ${Math.floor(MAX_PDF_BYTES / (1024 * 1024))} MB)`,
        };
      }
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    if (buffer.length > MAX_PDF_BYTES) {
      return {
        ok: false,
        error: `Downloaded file is too large (max ${Math.floor(MAX_PDF_BYTES / (1024 * 1024))} MB)`,
      };
    }

    if (!bufferLooksLikePdf(buffer)) {
      return {
        ok: false,
        error:
          "The downloaded file is not a PDF (missing %PDF- header). " +
          "Use a direct URL to the raw .pdf file (some sites use HTML download pages — link to the PDF itself).",
      };
    }

    return { ok: true, buffer, contentType };
  } catch (e) {
    const name = (e as Error).name;
    if (name === "AbortError") {
      return { ok: false, error: `Download timed out after ${FETCH_TIMEOUT_MS / 1000}s` };
    }
    return { ok: false, error: `Download failed: ${(e as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}
