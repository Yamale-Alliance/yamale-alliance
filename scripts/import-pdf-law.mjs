/**
 * Import a single PDF as a law: extract text and insert into Supabase.
 * Handles large PDFs (extracts full text into laws.content / laws.content_plain).
 *
 * Usage (from project root):
 *   node --env-file=.env scripts/import-pdf-law.mjs "/path/to/file.pdf" [options]
 *
 * Options:
 *   --country "Ghana"           (default: Ghana) — must be one of: Ghana, Kenya, Tunisia, Ethiopia, Eritrea, Madagascar, Rwanda, Seychelles, Senegal, Zambia, Mali, Sierra Leone, Togo, Niger, Nigeria, Liberia, South Africa, Morocco, Sudan, Guinea, Guinea-Bissau, Burundi, Comoros, Djibouti
 *   --title "Display title"     (default: filename without .pdf)
 *   --category "Corporate Law"  (default: "Corporate Law")
 *   --year 2019                 (optional)
 *   --status "In force"         (default: "In force")
 *   --source-url "https://..."   (optional) — original PDF URL for reference
 *   --update                    Update existing law (match by title + category + country) instead of inserting
 *   --force-ocr                 Always run Tesseract OCR and use OCR text (for scanned PDFs)
 *
 * Example (Ghana):
 *   node --env-file=.env scripts/import-pdf-law.mjs "/path/to/file.pdf" --title "Ghana Corporate Laws" --category "Corporate Law"
 *
 * Example (Kenya):
 *   node --env-file=.env scripts/import-pdf-law.mjs "/path/to/companies-act-2015.pdf" --country Kenya --title "Companies Act, 2015" --category "Corporate Law" --year 2015
 */

import { createClient } from "@supabase/supabase-js";
import { readFile, readdir, mkdtemp, rm } from "fs/promises";
import { basename, join } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { PDFParse } from "pdf-parse";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Use: node --env-file=.env ...");
  process.exit(1);
}

const args = process.argv.slice(2);

const VALID_COUNTRIES = [
  "Ghana",
  "Kenya",
  "Tunisia",
  "Ethiopia",
  "Eritrea",
  "Madagascar",
  "Rwanda",
  "Seychelles",
  "Senegal",
  "Zambia",
  "Mali",
  "Sierra Leone",
  "Togo",
  "Niger",
  "Nigeria",
  "Liberia",
  "South Africa",
  "Morocco",
  "Sudan",
  "Guinea",
  "Guinea-Bissau",
  "Burundi",
  "Comoros",
  "Djibouti",
];

const VALID_CATEGORIES = [
  "Corporate Law",
  "Tax Law",
  "Labor/Employment Law",
  "Intellectual Property Law",
  "Data Protection and Privacy Law",
  "International Trade Laws",
  "Anti-Bribery and Corruption Law",
  "Dispute Resolution",
  "Environmental",
];

const pdfPath = args.find((a) => !a.startsWith("--"));
if (!pdfPath) {
  console.error(
    "Usage: node --env-file=.env scripts/import-pdf-law.mjs \"/path/to/file.pdf\" [--country NAME] [--title \"...\"] [--category \"...\"] [--year 2019] [--source-url \"...\"] [--status \"In force\"] [--update]\n  Valid countries:",
    VALID_COUNTRIES.join(", ")
  );
  process.exit(1);
}

function getOpt(name, defaultValue) {
  const i = args.indexOf(name);
  if (i === -1 || !args[i + 1]) return defaultValue;
  return args[i + 1];
}

function normaliseTitleCase(raw) {
  if (!raw) return raw;
  const trimmed = raw.trim();
  const hasLetters = /[A-Za-z]/.test(trimmed);
  const isAllCaps = hasLetters && trimmed === trimmed.toUpperCase();
  const base = isAllCaps ? trimmed.toLowerCase() : trimmed;
  return base
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      if (/^(of|and|the|for|to|in|on|at|by|with|or|vs\.?)$/i.test(word)) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

const countryName = getOpt("--country", "Ghana");
const rawTitle = getOpt("--title", basename(pdfPath, ".pdf").replace(/-/g, " "));
const title = normaliseTitleCase(rawTitle);
const category = getOpt("--category", "Corporate Law");
const yearStr = getOpt("--year", null);
const status = getOpt("--status", "In force");
const sourceUrl = getOpt("--source-url", null);
const doUpdate = args.includes("--update");
const forceOcr = args.includes("--force-ocr");
const year = yearStr ? parseInt(yearStr, 10) : null;

if (!VALID_COUNTRIES.includes(countryName)) {
  console.error("Invalid --country. Use one of:", VALID_COUNTRIES.join(", "));
  process.exit(1);
}
if (!VALID_CATEGORIES.includes(category)) {
  console.error("Invalid --category. Use one of:", VALID_CATEGORIES.join(", "));
  process.exit(1);
}

function runExecFile(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (error, stdout, stderr) => {
      if (error) {
        const msg = stderr?.toString?.().trim() || error.message;
        return reject(new Error(msg));
      }
      resolve(stdout?.toString?.() ?? "");
    });
  });
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function isLikelyTocLine(line) {
  const t = line.trim();
  if (!t) return true;
  if (/\.{2,}\s*\d+\s*$/.test(t)) return true; // dotted leaders ending in page number
  if (/^(part|chapter|section|article)\s+.*\s+\d+\s*$/i.test(t)) return true;
  if (/^\d+(\.\d+)*\s+.*\s+\d+\s*$/.test(t)) return true;
  return false;
}

function isLikelySectionHeading(line) {
  const t = collapseWhitespace(line);
  if (!t) return false;
  if (/^(part|chapter|section|article|schedule|appendix)\b/i.test(t)) return true;
  if (/^\d+(\.\d+)*[\)\.]?\s+[A-Z]/.test(t)) return true;
  if (/^[IVXLC]+\.\s+[A-Z]/.test(t)) return true;
  if (t === t.toUpperCase() && t.length >= 5 && t.length <= 120) return true;
  return false;
}

function stripTableOfContents(rawText) {
  const lines = rawText.split(/\r?\n/);
  if (lines.length < 10) return rawText;

  const searchLimit = Math.min(lines.length, 300);
  let tocStart = -1;
  for (let i = 0; i < searchLimit; i++) {
    const t = lines[i].trim().toLowerCase();
    if (t === "table of contents" || t === "contents") {
      tocStart = i;
      break;
    }
  }
  if (tocStart === -1) return rawText;

  let tocEnd = -1;
  let nonTocStreak = 0;
  const endSearchLimit = Math.min(lines.length, tocStart + 500);
  for (let i = tocStart + 1; i < endSearchLimit; i++) {
    const line = lines[i];
    if (isLikelyTocLine(line)) {
      nonTocStreak = 0;
      continue;
    }
    if (isLikelySectionHeading(line)) {
      nonTocStreak += 1;
      if (nonTocStreak >= 2) {
        tocEnd = i - 1;
        break;
      }
    } else {
      nonTocStreak = 0;
    }
  }

  if (tocEnd === -1) {
    tocEnd = Math.min(lines.length - 1, tocStart + 120);
  }

  const filtered = [...lines.slice(0, tocStart), ...lines.slice(tocEnd + 1)];
  return filtered.join("\n");
}

function toMarkdownFromText(rawText) {
  const lines = rawText.split(/\r?\n/);
  const out = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    out.push(collapseWhitespace(paragraph.join(" ")));
    paragraph = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      flushParagraph();
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
      continue;
    }

    if (/^[-*]\s+/.test(t) || /^\d+[\.\)]\s+/.test(t)) {
      flushParagraph();
      out.push(t);
      continue;
    }

    if (isLikelySectionHeading(t)) {
      flushParagraph();
      const heading = collapseWhitespace(t);
      const prefix = /^(part|chapter)\b/i.test(heading) ? "## " : "### ";
      out.push(`${prefix}${heading}`);
      out.push("");
      continue;
    }

    paragraph.push(t);
  }

  flushParagraph();

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function markdownToPlainText(markdown) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+[\.\)]\s+/gm, "")
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\r/g, "")
    .trim();
}

async function ocrPdfWithTesseract(pdfPath) {
  console.log("Falling back to Tesseract OCR (scanned PDF detected)...");
  let tmpDir;
  try {
    tmpDir = await mkdtemp(join(tmpdir(), "ocr-"));
    const prefix = join(tmpDir, "page");

    // Convert PDF pages to PNG images (requires `pdftoppm` from poppler)
    try {
      await runExecFile("pdftoppm", ["-r", "300", "-png", pdfPath, prefix]);
    } catch (e) {
      console.warn("pdftoppm failed:", e.message);
      return "";
    }

    // Discover generated images (pdftoppm may output page-1.png, page-01.png, etc.)
    const names = await readdir(tmpDir);
    const pages = names
      .filter((n) => n.endsWith(".png"))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
        return numA - numB || a.localeCompare(b);
      })
      .map((n) => join(tmpDir, n));

    if (pages.length === 0) {
      console.warn("No page images generated for OCR. Check that the PDF has pages and pdftoppm is on PATH.");
      return "";
    }

    let combined = "";
    for (const img of pages) {
      try {
        // Run Tesseract on each image; output to stdout
        const out = await runExecFile("tesseract", [img, "stdout", "-l", "eng"]);
        combined += `\n${out}`;
      } catch (e) {
        console.warn("Tesseract OCR failed for page:", img, "-", e.message);
      }
    }

    return combined.trim();
  } catch (e) {
    console.warn("OCR pipeline failed:", e.message);
    return "";
  } finally {
    if (tmpDir) {
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

async function main() {
  let buffer;
  try {
    buffer = await readFile(pdfPath);
  } catch (e) {
    console.error("Failed to read PDF:", e.message);
    process.exit(1);
  }

  console.log("Extracting text from PDF (may take a moment for large files)...");
  let text = "";
  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    text = result.text || "";
  } catch (e) {
    console.error("PDF parse failed, will attempt OCR:", e.message);
    text = "";
  }

  const shouldTryOcr = forceOcr || !text || !text.trim() || text.trim().length < 500;
  if (shouldTryOcr) {
    if (forceOcr) {
      console.log("Running Tesseract OCR (--force-ocr)...");
    } else {
      console.warn(
        !text || !text.trim()
          ? "No or very little text extracted from PDF. Attempting Tesseract OCR..."
          : `Only ${text.trim().length} characters extracted; attempting Tesseract OCR for better text.`
      );
    }
    const ocrText = await ocrPdfWithTesseract(pdfPath);
    if (ocrText && ocrText.trim().length > (text?.trim?.()?.length ?? 0)) {
      console.log("OCR extracted", ocrText.trim().length, "characters (replacing original text).");
      text = ocrText;
    } else if (forceOcr && ocrText?.trim()) {
      text = ocrText;
      console.log("Using OCR text:", ocrText.trim().length, "characters.");
    } else if (!text || !text.trim()) {
      console.warn("OCR did not produce usable text. Inserting with empty content.");
    } else if (!forceOcr) {
      console.log("Keeping original extracted text (OCR was not better).");
    }
  } else {
    console.log("Extracted", text.length, "characters from PDF without needing OCR.");
  }

  const withoutToc = stripTableOfContents(text || "");
  const markdownContent = toMarkdownFromText(withoutToc || "");
  const plainContent = markdownToPlainText(markdownContent);

  console.log(
    `Prepared Markdown content (${markdownContent.length} chars) after TOC cleanup.`
  );

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: countries } = await supabase.from("countries").select("id").eq("name", countryName).limit(1);
  const countryId = countries?.[0]?.id;
  if (!countryId) {
    console.error("Country not found:", countryName, ". Add it via migration (e.g. 014_add_kenya_country.sql) or SQL.");
    process.exit(1);
  }

  const { data: categories } = await supabase.from("categories").select("id").eq("name", category).limit(1);
  const categoryId = categories?.[0]?.id;
  if (!categoryId) {
    console.error("Category not found:", category);
    process.exit(1);
  }

  let markdownTrimmed = markdownContent.trim() || null;
  let plainTrimmed = plainContent.trim() || null;
  if (markdownTrimmed) {
    markdownTrimmed = markdownTrimmed
      .replace(/\0/g, "")
      .replace(/\\/g, "\\\\");
  }
  if (plainTrimmed) {
    plainTrimmed = plainTrimmed
      .replace(/\0/g, "")
      .replace(/\\/g, "\\\\");
  }

  if (doUpdate) {
    const { data: existing, error: findErr } = await supabase
      .from("laws")
      .select("id")
      .eq("country_id", countryId)
      .eq("category_id", categoryId)
      .eq("title", title)
      .limit(1)
      .maybeSingle();
    if (findErr) {
      console.error("Lookup failed:", findErr.message);
      process.exit(1);
    }
    if (!existing) {
      console.error("No existing law found with that title and category. Run without --update to insert.");
      process.exit(1);
    }
    const { error: updateErr } = await supabase
      .from("laws")
      .update({
        content: markdownTrimmed,
        content_plain: plainTrimmed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (updateErr) {
      console.error("Update failed:", updateErr.message);
      process.exit(1);
    }
    console.log("Updated law:", existing.id, "—", title);
    return;
  }

  const row = {
    country_id: countryId,
    category_id: categoryId,
    title,
    source_url: sourceUrl || null,
    source_name: null,
    year,
    status,
    content: markdownTrimmed,
    content_plain: plainTrimmed,
  };

  const { data, error } = await supabase.from("laws").insert(row).select("id").single();
  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }
  console.log("Inserted law:", data.id, "—", title);
}

main();
