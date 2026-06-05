import type { AdvisoryDocument, AdvisoryPhase } from "@/lib/law-firm-development/types";
import { listMarketplaceZipFilePaths } from "@/lib/marketplace-zip-paths";

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.[^./]+$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchScore(doc: AdvisoryDocument, zipPath: string): number {
  const fileBase = zipPath.split(/[/\\]/).pop() ?? zipPath;
  const titleKey = normalizeKey(doc.title);
  const fileKey = normalizeKey(fileBase);
  const codeKey = normalizeKey(doc.code.replace(/-/g, " "));

  if (!titleKey || !fileKey) return 0;
  if (titleKey === fileKey) return 100;
  if (fileKey.includes(titleKey) || titleKey.includes(fileKey)) return 85;

  const titleWords = new Set(titleKey.split(" ").filter((w) => w.length > 2));
  const fileWords = fileKey.split(" ").filter((w) => w.length > 2);
  let overlap = 0;
  for (const w of fileWords) {
    if (titleWords.has(w)) overlap += 1;
  }
  let score = overlap * 12;

  if (codeKey.length >= 2 && fileKey.includes(codeKey.replace(/\s+/g, ""))) score += 25;
  if (fileKey.includes(doc.code.toLowerCase())) score += 30;

  return score;
}

/** Attach `sourcePath` from package ZIP entries to catalogue documents (best-effort matching). */
export function enrichPhasesWithZipPaths(
  phases: AdvisoryPhase[],
  zipPaths: string[]
): AdvisoryPhase[] {
  if (zipPaths.length === 0) return phases;

  const filePaths = zipPaths.filter((p) => !p.endsWith("/"));
  const used = new Set<string>();

  const assignDoc = (doc: AdvisoryDocument): AdvisoryDocument => {
    let best: { path: string; score: number } | null = null;
    for (const path of filePaths) {
      if (used.has(path)) continue;
      const score = matchScore(doc, path);
      if (score >= 24 && (!best || score > best.score)) {
        best = { path, score };
      }
    }
    if (!best) return doc;
    used.add(best.path);
    return { ...doc, sourcePath: best.path };
  };

  return phases.map((phase) => ({
    ...phase,
    categories: phase.categories.map((cat) => ({
      ...cat,
      documents: cat.documents.map(assignDoc),
    })),
  }));
}

/** Load ZIP paths from storage and enrich programme phases for in-workspace file open. */
export async function enrichPhasesFromPackageZip(
  filePath: string | null,
  phases: AdvisoryPhase[]
): Promise<AdvisoryPhase[]> {
  if (!filePath?.trim()) return phases;
  const paths = await listMarketplaceZipFilePaths(filePath);
  return enrichPhasesWithZipPaths(phases, paths);
}
