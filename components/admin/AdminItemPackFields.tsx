"use client";

import { useTranslations } from "next-intl";

type PartnerOption = {
  id: string;
  title: string;
  price_cents: number;
};

type AdminItemPackFieldsProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  label: string;
  onLabelChange: (value: string) => void;
  packPriceUsd: string;
  onPackPriceUsdChange: (value: string) => void;
  partnerItemIds: string[];
  onPartnerItemIdsChange: (ids: string[]) => void;
  partnerOptions: PartnerOption[];
  excludeItemId?: string | null;
};

export function AdminItemPackFields({
  enabled,
  onEnabledChange,
  label,
  onLabelChange,
  packPriceUsd,
  onPackPriceUsdChange,
  partnerItemIds,
  onPartnerItemIdsChange,
  partnerOptions,
  excludeItemId,
}: AdminItemPackFieldsProps) {
  const t = useTranslations("admin.vault.itemPackFields");
  const options = partnerOptions.filter((o) => o.id !== excludeItemId && o.price_cents > 0);

  const togglePartner = (id: string) => {
    if (partnerItemIds.includes(id)) {
      onPartnerItemIdsChange(partnerItemIds.filter((x) => x !== id));
    } else {
      onPartnerItemIdsChange([...partnerItemIds, id]);
    }
  };

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
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("packNameLabel")}</label>
            <input
              type="text"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder={t("packNamePlaceholder")}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("wholePackPriceLabel")}</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={packPriceUsd}
              onChange={(e) => onPackPriceUsdChange(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder={t("wholePackPricePlaceholder")}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("wholePackPriceHint")}
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t("packIncludesLabel")}</p>
            {options.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noOptionsHint")}</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-3">
                {options.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={partnerItemIds.includes(item.id)}
                        onChange={() => togglePartner(item.id)}
                        className="mt-0.5 rounded border-input"
                      />
                      <span>
                        {item.title}
                        <span className="ml-1 text-muted-foreground">
                          — ${(item.price_cents / 100).toFixed(2)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {t("packIncludesHint")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
