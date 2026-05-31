"use client";

import { VAULT_SUBCATEGORIES } from "@/lib/marketplace-vault-categories";

type Props = {
  name?: string;
  defaultValue?: string | null;
  className?: string;
};

/** Vault series picker — free collections when price is $0; paid series at any price. */
export function AdminVaultSubcategorySelect({
  name = "vault_subcategory",
  defaultValue,
  className,
}: Props) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium">Vault series (optional)</label>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">— None —</option>
        {VAULT_SUBCATEGORIES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
            {s.paid ? " (paid series)" : " (free series)"}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">
        Free series apply when price is $0. Paid series (e.g. Contract Library) apply at any price. Add more in{" "}
        <code className="rounded bg-muted px-1">lib/marketplace-vault-categories.ts</code>.
      </p>
    </div>
  );
}
