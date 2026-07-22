/**
 * Extract text from a PDF buffer.
 * Prefer embedded text; when OCR is needed, try local Tesseract (pdftoppm) first,
 * then Claude Vision cloud OCR (production/Vercel).
 */

import { readdir, mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { cloudOcrPdfBuffer, isCloudOcrConfigured } from "@/lib/cloud-pdf-ocr";

const execFileAsync = promisify(execFile);

const OCR_UNAVAILABLE_MESSAGE =
  "This PDF has no selectable text (typical for scans), and OCR is not available. " +
  "On production, set CLAUDE_API_KEY to enable cloud OCR, or install pdftoppm + tesseract on the host, " +
  "or upload a text-layer PDF.";

const OCR_EMPTY_MESSAGE =
  "No text could be extracted (embedded text empty and OCR returned nothing). " +
  "Try Force OCR, a clearer scan, or a PDF with a selectable text layer.";

async function runCommand(cmd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(cmd, args);
  return (stdout as string)?.toString?.() ?? "";
}

function isCommandMissingError(err: unknown): boolean {
  const e = err as NodeJS.ErrnoException & { message?: string };
  if (e?.code === "ENOENT") return true;
  const msg = e?.message ?? "";
  return /ENOENT|not found|spawn .* ENOENT/i.test(msg);
}

let ocrToolsCached: boolean | null = null;

/** True when both pdftoppm and tesseract are executable on PATH. */
export async function areOcrToolsAvailable(): Promise<boolean> {
  if (ocrToolsCached != null) return ocrToolsCached;
  try {
    await execFileAsync("pdftoppm", ["-v"]);
    await execFileAsync("tesseract", ["--version"]);
    ocrToolsCached = true;
  } catch {
    ocrToolsCached = false;
  }
  return ocrToolsCached;
}

/** Score 0–1; low = likely garbled embedded font / broken text layer (common in gazettes). */
function scoreEmbeddedTextQuality(text: string): { score: number; suspicious: boolean } {
  const t = text.trim();
  if (!t) return { score: 0, suspicious: true };
  const letters = (t.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  const letterRatio = letters / Math.max(t.length, 1);
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { score: 0, suspicious: true };
  const alnum = words.map((w) => w.replace(/[^A-Za-z0-9]/g, "")).filter((w) => w.length > 0);
  const avgLen = alnum.length ? alnum.reduce((a, w) => a + w.length, 0) / alnum.length : 0;
  const shortRatio = words.filter((w) => w.length <= 2).length / words.length;
  const suspicious =
    letterRatio < 0.42 ||
    avgLen < 3.8 ||
    shortRatio > 0.45 ||
    (t.length > 800 && letterRatio < 0.48);
  const score = Math.max(
    0,
    Math.min(
      1,
      letterRatio * 0.42 + Math.min(avgLen / 10, 1) * 0.35 + (1 - Math.min(shortRatio * 1.6, 1)) * 0.23
    )
  );
  return { score, suspicious };
}

async function tesseractPage(img: string): Promise<string> {
  try {
    return await runCommand("tesseract", [img, "stdout", "-l", "eng+afr"]);
  } catch {
    return await runCommand("tesseract", [img, "stdout", "-l", "eng"]);
  }
}

export async function ocrPdfBuffer(pdfPath: string): Promise<string> {
  let tmpDir: string | undefined;
  try {
    tmpDir = await mkdtemp(join(tmpdir(), "ocr-"));
    const prefix = join(tmpDir, "page");

    try {
      await execFileAsync("pdftoppm", ["-r", "300", "-png", pdfPath, prefix]);
    } catch (e) {
      if (isCommandMissingError(e)) {
        console.warn("pdftoppm not available on this host");
        return "";
      }
      console.warn("pdftoppm failed:", (e as Error).message);
      return "";
    }

    const names = await readdir(tmpDir);
    const pages = names
      .filter((n) => n.endsWith(".png"))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
        return numA - numB || a.localeCompare(b);
      })
      .map((n) => join(tmpDir!, n));

    if (pages.length === 0) return "";

    let combined = "";
    for (const img of pages) {
      try {
        const out = await tesseractPage(img);
        combined += `\n${out}`;
      } catch {
        // skip failed page
      }
    }
    return combined.trim();
  } finally {
    if (tmpDir) {
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}

function pickBetterText(params: {
  embedded: string;
  ocrText: string;
  forceOcr: boolean;
}): string {
  const embTrim = params.embedded.trim();
  const ocrTrim = params.ocrText.trim();
  const qEmb = scoreEmbeddedTextQuality(embTrim);
  const qOcr = scoreEmbeddedTextQuality(ocrTrim);

  if (!ocrTrim) return params.embedded;
  if (!embTrim) return params.ocrText;
  if (params.forceOcr) return params.ocrText;
  if (qOcr.score > qEmb.score + 0.06 || (qEmb.suspicious && qOcr.score >= qEmb.score)) {
    return params.ocrText;
  }
  if (ocrTrim.length > embTrim.length * 1.25 && qOcr.score >= qEmb.score - 0.05) {
    return params.ocrText;
  }
  return params.embedded;
}

export type ExtractPdfOptions = {
  /** When true, prefer OCR output over embedded text when OCR succeeds. */
  forceOcr?: boolean;
};

/**
 * Extract text from a PDF buffer. Uses pdf-parse first; if forceOcr is true,
 * embedded text is missing/short, or embedded text looks garbled (bad text layer),
 * runs local Tesseract and/or cloud OCR and picks the better result.
 */
export async function extractTextFromPdf(
  buffer: Buffer,
  options: ExtractPdfOptions = {}
): Promise<string> {
  const { forceOcr = false } = options;

  let embedded = "";
  try {
    const { PDFParse } = await import("pdf-parse");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parser = new (PDFParse as any)({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    embedded = result?.text ?? "";
  } catch {
    embedded = "";
  }

  const embTrim = embedded?.trim() ?? "";
  const qEmb = scoreEmbeddedTextQuality(embTrim);

  const shouldRunOcr =
    forceOcr || !embTrim || embTrim.length < 500 || qEmb.suspicious;

  if (!shouldRunOcr) {
    return embedded;
  }

  const toolsOk = await areOcrToolsAvailable();
  if (toolsOk) {
    let tmpDir: string | undefined;
    try {
      tmpDir = await mkdtemp(join(tmpdir(), "pdf-"));
      const tmpFile = join(tmpDir, "doc.pdf");
      await writeFile(tmpFile, buffer);
      const ocrText = await ocrPdfBuffer(tmpFile);
      if (ocrText.trim()) {
        return pickBetterText({ embedded, ocrText, forceOcr });
      }
    } catch (e) {
      console.warn("Local PDF OCR failed:", (e as Error).message);
    } finally {
      if (tmpDir) {
        try {
          await rm(tmpDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    }
  }

  if (isCloudOcrConfigured()) {
    try {
      console.info("Running cloud OCR for scanned/low-text PDF…");
      const cloud = await cloudOcrPdfBuffer(buffer);
      if (cloud.text.trim()) {
        return pickBetterText({ embedded, ocrText: cloud.text, forceOcr });
      }
      if (!embTrim) {
        throw new Error(OCR_EMPTY_MESSAGE);
      }
      return embedded;
    } catch (e) {
      const msg = (e as Error).message;
      if (!embTrim) {
        if (msg === OCR_EMPTY_MESSAGE) throw e;
        throw new Error(`Cloud OCR failed and no embedded text was found: ${msg}`);
      }
      console.warn("Cloud OCR failed; using embedded text:", msg);
      return embedded;
    }
  }

  if (!embTrim) {
    throw new Error(OCR_UNAVAILABLE_MESSAGE);
  }
  return embedded;
}
