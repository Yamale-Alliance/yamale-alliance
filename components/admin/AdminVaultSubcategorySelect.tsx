"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  listVaultSeries,
  setVaultSeriesRegistry,
  vaultSeriesSuggestedItemPriceCents,
} from "@/lib/marketplace-vault-categories";
import type { VaultSeriesRecord } from "@/lib/marketplace-vault-series";

type Props = {
  name?: string;
  defaultValue?: string | null;
  className?: string;
};

/** Vault series picker — loads DB + fallback registry. */
export function AdminVaultSubcategorySelect({
  name = "vault_subcategory",
  defaultValue,
  className,
}: Props) {
  const t = useTranslations("admin.vault.subcategorySelect");
  const [series, setSeries] = useState<VaultSeriesRecord[]>(() => listVaultSeries());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    fetch(`${origin}/api/admin/marketplace/vault-series`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.series)) {
          setVaultSeriesRegistry(data.series);
          setSeries(data.series);
        }
      })
      .catch(() => {
        /* keep fallback */
      })
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium">{t("label")}</label>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">{t("none")}</option>
        {series.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
            {s.paid ? ` (${t("paidSeries")})` : ` (${t("freeSeries")})`}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("hint")} {loaded ? t("loadedManageHint") : t("loading")}
      </p>
      {defaultValue === "quick_investment_guide" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("quickInvestmentGuide.before")}{" "}
          <code className="rounded bg-muted px-1">public/vault/quick-investment-guide/cover.jpg</code>.{" "}
          {t("quickInvestmentGuide.after", {
            amount: ((vaultSeriesSuggestedItemPriceCents("quick_investment_guide") ?? 1900) / 100).toFixed(0),
          })}
        </p>
      ) : null}
    </div>
  );
}
