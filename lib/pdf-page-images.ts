/**
 * Render PDF pages to PNG buffers in Node (pdfjs-dist + @napi-rs/canvas).
 * Used by cloud OCR when pdftoppm is not available (e.g. Vercel).
 */

import { createRequire } from "module";
import { pathToFileURL } from "url";
import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";

export type PdfPagePng = {
  pageNumber: number;
  png: Buffer;
  width: number;
  height: number;
};

type NodeCanvasPair = {
  canvas: Canvas;
  context: SKRSContext2D;
};

/**
 * pdfjs calls `new CanvasFactory({ enableHWA })` — must be a constructor, not a plain object.
 */
class NapiCanvasFactory {
  // pdfjs passes options; we ignore enableHWA (napi-rs canvas has no HWA flag).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_options?: { enableHWA?: boolean }) {}

  create(width: number, height: number): NodeCanvasPair {
    const canvas = createCanvas(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
    return {
      canvas,
      context: canvas.getContext("2d"),
    };
  }

  reset(canvasAndContext: NodeCanvasPair, width: number, height: number): void {
    canvasAndContext.canvas.width = Math.max(1, Math.floor(width));
    canvasAndContext.canvas.height = Math.max(1, Math.floor(height));
  }

  destroy(canvasAndContext: NodeCanvasPair): void {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Max pages to rasterize for cloud OCR (cost + timeout guard). */
export function cloudOcrMaxPages(): number {
  return Math.min(120, parsePositiveInt(process.env.LAW_CLOUD_OCR_MAX_PAGES, 40));
}

/** Render scale for page images (1.5 ≈ 108dpi-ish on letter; 2 is sharper / heavier). */
export function cloudOcrRenderScale(): number {
  const raw = process.env.LAW_CLOUD_OCR_SCALE?.trim();
  if (!raw) return 1.75;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 1 && n <= 3 ? n : 1.75;
}

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

/**
 * Wire the pdfjs worker for Node/serverless.
 * Vercel file tracing often omits `pdf.worker.mjs` unless we import it and set an absolute path;
 * setting `globalThis.pdfjsWorker` lets the in-process fake worker skip the broken relative import.
 */
async function configurePdfjsForNode(pdfjs: PdfjsModule): Promise<void> {
  // Worker build has no types in pdfjs-dist; runtime export is WorkerMessageHandler.
  const worker = (await import(
    /* webpackIgnore: true */
    "pdfjs-dist/legacy/build/pdf.worker.mjs"
  )) as { WorkerMessageHandler?: unknown };
  (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker = worker;

  try {
    const require = createRequire(import.meta.url);
    const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";
  }
}

/**
 * Open a PDF once and invoke `onPage` for each rasterized page (up to maxPages).
 * Frees each canvas before the next page to limit peak memory.
 */
export async function mapPdfPagesToPng<T>(
  pdfBuffer: Buffer,
  onPage: (page: PdfPagePng, meta: { totalPages: number; truncated: boolean }) => Promise<T>,
  options?: { maxPages?: number; scale?: number }
): Promise<{ results: T[]; totalPages: number; truncated: boolean; pagesProcessed: number }> {
  const maxPages = options?.maxPages ?? cloudOcrMaxPages();
  const scale = options?.scale ?? cloudOcrRenderScale();

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  await configurePdfjsForNode(pdfjs);

  const data = new Uint8Array(pdfBuffer);
  const canvasFactory = new NapiCanvasFactory();

  const loadingTask = pdfjs.getDocument({
    data,
    // Class (constructor), not an instance — pdfjs does `new CanvasFactory(...)`.
    CanvasFactory: NapiCanvasFactory,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const limit = Math.min(totalPages, maxPages);
  const truncated = totalPages > limit;
  const results: T[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= limit; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
      try {
        await page.render({
          canvas: canvasAndContext.canvas as unknown as HTMLCanvasElement,
          canvasContext: canvasAndContext.context as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;

        const rendered: PdfPagePng = {
          pageNumber,
          png: canvasAndContext.canvas.toBuffer("image/png"),
          width: canvasAndContext.canvas.width,
          height: canvasAndContext.canvas.height,
        };
        results.push(await onPage(rendered, { totalPages, truncated }));
      } finally {
        canvasFactory.destroy(canvasAndContext);
        page.cleanup();
      }
    }
  } finally {
    await pdf.destroy();
  }

  return {
    results,
    totalPages,
    truncated,
    pagesProcessed: limit,
  };
}

/**
 * Rasterize up to `maxPages` PDF pages to PNG (all held in memory).
 * Prefer `mapPdfPagesToPng` for cloud OCR to keep peak memory lower.
 */
export async function renderPdfPagesToPng(
  pdfBuffer: Buffer,
  options?: { maxPages?: number; scale?: number }
): Promise<{ pages: PdfPagePng[]; totalPages: number; truncated: boolean }> {
  const { results, totalPages, truncated } = await mapPdfPagesToPng(
    pdfBuffer,
    async (page) => page,
    options
  );
  return { pages: results, totalPages, truncated };
}
