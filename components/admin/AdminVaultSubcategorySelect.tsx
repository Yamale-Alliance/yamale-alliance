"use client";

import { VAULT_FREE_SUBCATEGORIES } from "@/lib/marketplace-vault-categories";

type Props = {
  name?: string;
  defaultValue?: string | null;
  className?: string;
};

/** Free Vault series picker (only saved when item price is 0). */
export function AdminVaultSubcategorySelect({
  name = "vault_subcategory",
  defaultValue,
  className,
}: Props) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium">Free collection (optional)</label>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">— None (general free) —</option>
        {VAULT_FREE_SUBCATEGORIES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">
        Applies when price is $0. Shown under <strong>Free</strong> on the Vault. Add more series in{" "}
        <code className="rounded bg-muted px-1">lib/marketplace-vault-categories.ts</code>.
      </p>
    </div>
  );
}
