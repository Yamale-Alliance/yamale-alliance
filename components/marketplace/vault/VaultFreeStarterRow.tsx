"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { VaultCoverImage } from "@/components/marketplace/VaultCoverImage";
import { displayVaultProductTitle } from "@/lib/marketplace-display";
import { marketplaceItemDetailHref } from "@/lib/marketplace-public-url";
import { isMarketplaceZip } from "@/lib/marketplace-zip-package";
import type { MarketplaceBrowseItem } from "@/lib/marketplace-browse-data";

type VaultFreeStarterRowProps = {
  items: MarketplaceBrowseItem[];
  typeLabel: (type: string) => string;
};

export function VaultFreeStarterRow({ items, typeLabel }: VaultFreeStarterRowProps) {
  const t = useTranslations("marketplace");
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <section className="border-b border-border/70">
      <div className="mx-auto max-w-[1140px] px-6 pb-2 pt-10">
        <h2 className="heading text-[1.4rem] font-bold tracking-tight text-[color:var(--brand-navy)]">
          {t("landing.sectionFreeStart")}
        </h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 3).map((item) => {
            const href = marketplaceItemDetailHref({
              id: item.id,
              slug: item.slug,
              packagePage: isMarketplaceZip(item),
            });
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(href, { scroll: true })}
                className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-card p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(13,27,42,0.14)]"
              >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {item.image_url ? (
                    <VaultCoverImage
                      src={item.image_url}
                      className="h-full w-full object-cover"
                      priority={false}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[color:var(--muted)] text-xs font-semibold text-muted-foreground">
                      {t("free")}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 pr-1">
                  <h3 className="heading text-[0.92rem] font-bold leading-snug text-[color:var(--brand-navy)]">
                    {displayVaultProductTitle(item.title)}
                  </h3>
                  <p className="mt-1.5 text-[0.78rem] text-[color:var(--brand-copper)]">
                    <span className="font-bold text-[color:var(--primary)]">{t("free")}</span>
                    {" · "}
                    {typeLabel(item.type)}
                    {item.vault_subcategory ? ` · ${item.vault_subcategory.replace(/_/g, " ")}` : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
