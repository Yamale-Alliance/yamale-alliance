import { VAULT_FOCUS_COUNTRY_OPTIONS } from "@/lib/marketplace-vault-country";

type AdminVaultFocusCountrySelectProps = {
  defaultValue?: string | null;
  className?: string;
};

export function AdminVaultFocusCountrySelect({
  defaultValue,
  className,
}: AdminVaultFocusCountrySelectProps) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium">Focus country (map on card)</label>
      <select
        name="focus_country"
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">All Africa (default)</option>
        {VAULT_FOCUS_COUNTRY_OPTIONS.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">
        Shown on the vault card when no cover image is set. Pick a country for a country map, or leave blank for the
        Africa continent.
      </p>
    </div>
  );
}
