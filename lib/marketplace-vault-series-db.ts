/** Detect PostgREST errors when marketplace_vault_series is not migrated yet. */

export const VAULT_SERIES_MIGRATION_FILE =
  "supabase/migrations/20260604120000_marketplace_vault_series.sql";

export const VAULT_SERIES_MIGRATION_HINT =
  `Run the migration in Supabase: open SQL Editor and execute ${VAULT_SERIES_MIGRATION_FILE}, or run \`supabase db push\` from the project root.`;

export function isMarketplaceVaultSeriesTableMissing(message: string): boolean {
  const m = message.toLowerCase();
  if (
    m.includes("marketplace_vault_series") &&
    (m.includes("schema cache") ||
      m.includes("could not find the table") ||
      m.includes("does not exist") ||
      m.includes("relation") ||
      m.includes("no such table"))
  ) {
    return true;
  }
  return m.includes("schema cache") && m.includes("could not find the table");
}

export function assertVaultSeriesTableAvailable(error: { message?: string } | null): void {
  if (error?.message && isMarketplaceVaultSeriesTableMissing(error.message)) {
    throw new Error(`Vault series table is not set up yet. ${VAULT_SERIES_MIGRATION_HINT}`);
  }
}
