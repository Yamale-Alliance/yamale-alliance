/**
 * Cloud OCR for scanned law PDFs via Claude Vision.
 * Used when local pdftoppm/tesseract are unavailable (production/Vercel).
 */

import { mapPdfPagesToPng, cloudOcrMaxPages } from "@/lib/pdf-page-images";

const CLAUDE_URL = "https://api.anthropic.com/v1/messages";

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function isCloudOcrConfigured(): boolean {
  if (process.env.LAW_CLOUD_OCR_DISABLED === "1" || process.env.LAW_CLOUD_OCR_DISABLED === "true") {
    return false;
  }
  const key = process.env.CLAUDE_API_KEY?.trim();
  return Boolean(key && key.length >= 20);
}

export function getCloudOcrModel(): string {
  return (
    process.env.LAW_CLOUD_OCR_MODEL?.trim() ||
    process.env.CLAUDE_OCR_MODEL?.trim() ||
    process.env.CLAUDE_MODEL?.trim() ||
    "claude-haiku-4-5"
  );
}

function interPageDelayMs(): number {
  return Math.min(5_000, parsePositiveInt(process.env.LAW_CLOUD_OCR_DELAY_MS, 400));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ocrPngWithClaude(params: {
  png: Buffer;
  pageNumber: number;
  totalPages: number;
}): Promise<string> {
  const apiKey = process.env.CLAUDE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("CLAUDE_API_KEY is not configured for cloud OCR");
  }

  const prompt = `You are extracting text from a scanned legal statute page (page ${params.pageNumber} of ${params.totalPages}).

Return ONLY the readable text from this page, in reading order.
- Preserve paragraph breaks and section/article numbers.
- Do not add commentary, titles like "Page N", or markdown fences.
- If the page is blank or unreadable, return an empty string.
- Keep original language (English, French, Arabic, Portuguese, etc.).`;

  const res = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: getCloudOcrModel(),
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: params.png.toString("base64"),
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloud OCR HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = Array.isArray(json.content)
    ? json.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n")
    : "";

  return text
    .trim()
    .replace(/^```[\w]*\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();
}

export type CloudOcrResult = {
  text: string;
  pagesProcessed: number;
  totalPages: number;
  truncated: boolean;
};

/**
 * OCR a PDF buffer via Claude Vision (rasterize pages with pdfjs, then read each image).
 */
export async function cloudOcrPdfBuffer(pdfBuffer: Buffer): Promise<CloudOcrResult> {
  if (!isCloudOcrConfigured()) {
    throw new Error(
      "Cloud OCR is not configured. Set CLAUDE_API_KEY (and leave LAW_CLOUD_OCR_DISABLED unset)."
    );
  }

  const maxPages = cloudOcrMaxPages();
  const delay = interPageDelayMs();
  const parts: string[] = [];
  let lastPage = 0;

  const { totalPages, truncated, pagesProcessed } = await mapPdfPagesToPng(
    pdfBuffer,
    async (page, meta) => {
      lastPage = page.pageNumber;
      try {
        const text = await ocrPngWithClaude({
          png: page.png,
          pageNumber: page.pageNumber,
          totalPages: meta.totalPages,
        });
        if (text) parts.push(text);
      } catch (err) {
        console.warn(`Cloud OCR failed on page ${page.pageNumber}:`, (err as Error).message);
      }
      if (page.pageNumber < Math.min(meta.totalPages, maxPages) && delay > 0) {
        await sleep(delay);
      }
      return page.pageNumber;
    },
    { maxPages }
  );

  let text = parts.join("\n\n").trim();
  if (truncated && text) {
    text += `\n\n[OCR note: only the first ${pagesProcessed || lastPage} of ${totalPages} pages were processed. Raise LAW_CLOUD_OCR_MAX_PAGES to include more.]`;
  }

  return {
    text,
    pagesProcessed,
    totalPages,
    truncated,
  };
}
