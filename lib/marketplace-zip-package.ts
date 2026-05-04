/** ZIP marketplace delivery (e.g. document bundles). */
export function isMarketplaceZip(item: {
  file_format?: string | null;
  file_name?: string | null;
}): boolean {
  const fmt = item.file_format?.toLowerCase() ?? "";
  const name = item.file_name?.toLowerCase() ?? "";
  return fmt === "zip" || name.endsWith(".zip");
}

/**
 * Built-in rich landing for the African Law Firm Development Package (repo-maintained, not admin HTML).
 * Other ZIP products use a minimal package summary until a dedicated template exists.
 */
export function hasLawFirmDevelopmentBuiltInLanding(item: {
  title: string;
  file_format?: string | null;
  file_name?: string | null;
}): boolean {
  if (!isMarketplaceZip(item)) return false;
  const t = item.title.toLowerCase();
  return (
    t.includes("law firm development") ||
    (t.includes("law firm") && t.includes("development") && t.includes("package")) ||
    t.includes("african law firm")
  );
}
