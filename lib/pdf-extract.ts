/**
 * Extract text from a PDF buffer. Supports optional Tesseract OCR for scanned PDFs.
 * Used by the admin "Add law" API when uploading PDFs.
 */

import { readdir, mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

async function runCommand(cmd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(cmd, args);
  return (stdout as string)?.toString?.() ?? "";
}

export async function ocrPdfBuffer(pdfPath: string): Promise<string> {
  let tmpDir: string | undefined;
  try {
    tmpDir = await mkdtemp(join(tmpdir(), "ocr-"));
    const prefix = join(tmpDir, "page");

    try {
      await execFileAsync("pdftoppm", ["-r", "300", "-png", pdfPath, prefix]);
    } catch (e) {
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
        const out = await runCommand("tesseract", [img, "stdout", "-l", "eng"]);
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

export type ExtractPdfOptions = {
  /** When true, always run Tesseract OCR instead of relying on embedded text. */
  forceOcr?: boolean;
};

/**
 * Extract text from a PDF buffer. Uses pdf-parse first; if forceOcr is true
 * or extracted text is very short (< 500 chars), runs Tesseract OCR and uses
 * the better result.
 */
export async function extractTextFromPdf(
  buffer: Buffer,
  options: ExtractPdfOptions = {}
): Promise<string> {
  const { forceOcr = false } = options;

  let text = "";
  try {
    const { PDFParse } = await import("pdf-parse");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parser = new (PDFParse as any)({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    text = result?.text ?? "";
  } catch {
    text = "";
  }

  const shouldTryOcr = forceOcr || !text?.trim() || text.trim().length < 500;
  if (!shouldTryOcr) return text;

  let tmpDir: string | undefined;
  try {
    tmpDir = await mkdtemp(join(tmpdir(), "pdf-"));
    const tmpFile = join(tmpDir, "doc.pdf");
    await writeFile(tmpFile, buffer);
    const ocrText = await ocrPdfBuffer(tmpFile);
    if (ocrText && ocrText.trim().length > (text?.trim()?.length ?? 0)) {
      return ocrText;
    }
    if (forceOcr && ocrText?.trim()) return ocrText;
  } finally {
    if (tmpDir) {
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }

  return text;
}
