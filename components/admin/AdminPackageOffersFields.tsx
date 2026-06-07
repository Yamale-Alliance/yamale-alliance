"use client";

import { useTranslations } from "next-intl";

type AdminPackageOffersFieldsProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  standaloneUsd: string;
  onStandaloneUsdChange: (value: string) => void;
  bundleAddonUsd: string;
  onBundleAddonUsdChange: (value: string) => void;
  bundleWithItemId: string;
  onBundleWithItemIdChange: (value: string) => void;
  bundlePartnerOptions: Array<{ id: string; title: string; price_cents: number }>;
  showHint?: boolean;
};

export function AdminPackageOffersFields({
  enabled,
  onEnabledChange,
  standaloneUsd,
  onStandaloneUsdChange,
  bundleAddonUsd,
  onBundleAddonUsdChange,
  bundleWithItemId,
  onBundleWithItemIdChange,
  bundlePartnerOptions,
  showHint = true,
}: AdminPackageOffersFieldsProps) {
  const t = useTranslations("admin.vault.packageOffersFields");
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/20 p-4 sm:col-span-2">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="mt-1 rounded border-input"
        />
        <span>
          <span className="block text-sm font-medium">{t("title")}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {t("subtitle")}
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("standalonePriceLabel")}</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={standaloneUsd}
              onChange={(e) => onStandaloneUsdChange(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder={t("standalonePricePlaceholder")}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("standalonePriceHint")}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("bundleAddonPriceLabel")}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={bundleAddonUsd}
              onChange={(e) => onBundleAddonUsdChange(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder={t("bundleAddonPricePlaceholder")}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("bundleAddonPriceHint")}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">{t("bundleIncludesLabel")}</label>
            <select
              value={bundleWithItemId}
              onChange={(e) => onBundleWithItemIdChange(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("autoDetectOption")}</option>
              {bundlePartnerOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} — ${(item.price_cents / 100).toFixed(2)}
                </option>
              ))}
            </select>
            {showHint && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("bundleHint")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
