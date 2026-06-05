import type {
  AdvisoryCategory,
  AdvisoryDocument,
  AdvisoryPhase,
} from "@/lib/law-firm-development/types";
import { moduleKeyFromZipPath, titleFromZipPath } from "@/lib/marketplace-course";

export type ZipCourseFile = {
  sourcePath: string;
  moduleKey: string;
  title: string;
  sortKey: string;
};

export type ZipCoursePhase = {
  slug: string;
  number: number;
  folderName: string;
  title: string;
  subtitle: string;
  files: ZipCourseFile[];
};

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\\/g, "/");
}

function pathParts(path: string): string[] {
  return normalizePath(path).split("/").filter(Boolean);
}

/** Drop a single wrapper folder when every file shares it (e.g. "Tier 1 - Law Firm Development Package/"). */
export function stripSharedRootPrefix(allParts: string[][]): string[][] {
  if (allParts.length === 0) return allParts;
  let depth = 0;
  while (true) {
    const seg = allParts[0]?.[depth];
    if (!seg) break;
    const looksLikeWrapper =
      allParts.every((p) => p[depth] === seg) &&
      allParts.every((p) => p.length > depth + 1);
    if (!looksLikeWrapper) break;
    const isPhaseFolder = /^phase\s*\d+/i.test(seg);
    if (isPhaseFolder) break;
    depth += 1;
  }
  return allParts.map((p) => p.slice(depth));
}

export function parsePhaseNumber(folderName: string): number {
  const m = folderName.match(/phase\s*(\d+)/i);
  if (m) return parseInt(m[1], 10);
  return 999;
}

export function phaseSlugFromFolder(folderName: string): string {
  const n = parsePhaseNumber(folderName);
  if (n < 999) return `phase-${n}`;
  return (
    folderName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "phase-other"
  );
}

function phaseTitleFromFolder(folderName: string): string {
  const stripped = folderName.replace(/^phase\s*\d+\s*[-–—:]\s*/i, "").trim();
  return stripped || folderName;
}

function sortKeyForFilename(filename: string): string {
  const m = filename.match(/^(\d+)[.\s]*([A-Za-z])?/);
  if (m) {
    const num = m[1].padStart(4, "0");
    const letter = (m[2] ?? "").toLowerCase();
    return `${num}-${letter}-${filename.toLowerCase()}`;
  }
  return filename.toLowerCase();
}

function documentCodeFromFilename(filename: string, index: number): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const prefix = base.match(/^(\d+[.\s]*[A-Za-z]?)/)?.[1]?.replace(/\s+/g, "") ?? null;
  return prefix ?? `DOC-${String(index + 1).padStart(2, "0")}`;
}

function subcategoryKeyFromRelativeParts(relativeParts: string[]): string | null {
  if (relativeParts.length < 2) return null;
  return relativeParts
    .slice(0, -1)
    .join("/")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function subcategoryNameFromKey(key: string): string {
  return key
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Build phases from ZIP paths: each top-level folder = phase, each file under it = module.
 */
export function parseZipPathsToPhases(paths: string[]): ZipCoursePhase[] {
  const normalized = paths.map(normalizePath).filter(Boolean);
  const partsList = stripSharedRootPrefix(normalized.map(pathParts));

  const byPhaseFolder = new Map<string, ZipCourseFile[]>();

  for (let i = 0; i < normalized.length; i++) {
    const parts = partsList[i];
    if (!parts || parts.length < 2) continue;

    const phaseFolder = parts[0];
    const fileName = parts[parts.length - 1];
    const sourcePath = normalized[i];

    const list = byPhaseFolder.get(phaseFolder) ?? [];
    list.push({
      sourcePath,
      moduleKey: moduleKeyFromZipPath(sourcePath),
      title: titleFromZipPath(sourcePath),
      sortKey: sortKeyForFilename(fileName),
    });
    byPhaseFolder.set(phaseFolder, list);
  }

  const phases: ZipCoursePhase[] = [];
  for (const [folderName, files] of byPhaseFolder.entries()) {
    files.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { numeric: true }));
    const num = parsePhaseNumber(folderName);
    phases.push({
      slug: phaseSlugFromFolder(folderName),
      number: num < 999 ? num : phases.length + 1,
      folderName,
      title: phaseTitleFromFolder(folderName),
      subtitle: folderName,
      files,
    });
  }

  phases.sort((a, b) => a.number - b.number);
  return phases;
}

function categoriesForPhaseFiles(
  itemId: string,
  phaseSlug: string,
  files: ZipCourseFile[]
): AdvisoryCategory[] {
  const bySub = new Map<string, ZipCourseFile[]>();
  const flat: ZipCourseFile[] = [];

  for (const file of files) {
    const rel = pathParts(file.sourcePath);
    const relAfterPhase = rel.slice(1);
    const subKey = subcategoryKeyFromRelativeParts(relAfterPhase);
    if (subKey) {
      const list = bySub.get(subKey) ?? [];
      list.push(file);
      bySub.set(subKey, list);
    } else {
      flat.push(file);
    }
  }

  const categories: AdvisoryCategory[] = [];

  if (flat.length > 0) {
    const catId = `${phaseSlug}-documents`;
    categories.push({
      id: catId,
      code: "DOC",
      name: "Documents & templates",
      documents: flat.map((f, i) => documentFromZipFile(itemId, phaseSlug, catId, f, i)),
    });
  }

  for (const [subKey, subFiles] of [...bySub.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    subFiles.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { numeric: true }));
    const catId = `${phaseSlug}-${subKey}`;
    categories.push({
      id: catId,
      code: subKey.slice(0, 3).toUpperCase() || "SUB",
      name: subcategoryNameFromKey(subKey),
      documents: subFiles.map((f, i) => documentFromZipFile(itemId, phaseSlug, catId, f, i)),
    });
  }

  return categories;
}

function documentFromZipFile(
  itemId: string,
  phaseSlug: string,
  categoryId: string,
  file: ZipCourseFile,
  index: number
): AdvisoryDocument {
  const fileName = pathParts(file.sourcePath).pop() ?? file.title;
  return {
    id: `${itemId}:${file.moduleKey}`,
    code: documentCodeFromFilename(fileName, index),
    categoryId,
    phaseId: phaseSlug,
    kind: "template",
    title: file.title,
    description: `Package file: ${file.sourcePath}`,
    estimatedMinutes: 20,
    lastUpdated: "Package",
    sourcePath: file.sourcePath,
  };
}

/** Convert parsed ZIP structure to advisory workspace phases. */
export function zipPhasesToAdvisoryPhases(itemId: string, zipPhases: ZipCoursePhase[]): AdvisoryPhase[] {
  return zipPhases.map((zp) => ({
    id: zp.slug,
    slug: zp.slug,
    number: zp.number,
    title: zp.title,
    subtitle: zp.subtitle,
    description: `Implementation materials from ${zp.folderName}.`,
    categories: categoriesForPhaseFiles(itemId, zp.slug, zp.files),
  }));
}

export function buildAdvisoryPhasesFromZipPaths(itemId: string, paths: string[]): AdvisoryPhase[] {
  return zipPhasesToAdvisoryPhases(itemId, parseZipPathsToPhases(paths));
}
