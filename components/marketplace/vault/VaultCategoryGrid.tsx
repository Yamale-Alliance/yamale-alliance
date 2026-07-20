"use client";

import { useTranslations } from "next-intl";
import { VaultCoverImage } from "@/components/marketplace/VaultCoverImage";
import { VAULT_BROWSE_SERIES } from "@/lib/marketplace-vault-categories";

export type VaultDoorParam = "course" | "template" | "guidebook" | typeof VAULT_BROWSE_SERIES;

type VaultDoor = {
  param: VaultDoorParam;
  label: string;
  countLabel: string;
  imageUrl: string | null;
};

type VaultCategoryGridProps = {
  doors: VaultDoor[];
  onSelectCategory: (param: VaultDoorParam) => void;
};

export function VaultCategoryGrid({ doors, onSelectCategory }: VaultCategoryGridProps) {
  const t = useTranslations("marketplace");

  return (
    <section className="border-b border-border/70">
      <div className="mx-auto max-w-[1140px] px-6 py-14">
        <h2 className="heading text-[1.4rem] font-bold tracking-tight text-[color:var(--brand-navy)]">
          {t("landing.whatsInside")}
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {doors.map((door) => (
            <button
              key={door.param}
              type="button"
              onClick={() => onSelectCategory(door.param)}
              className="group relative aspect-[5/4] overflow-hidden rounded-xl text-left"
            >
              {door.imageUrl ? (
                <VaultCoverImage
                  src={door.imageUrl}
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  priority={false}
                />
              ) : (
                <div className="absolute inset-0 bg-[linear-gradient(160deg,var(--brand-navy-fixed),color-mix(in_srgb,var(--brand-navy-fixed)_75%,white))]" />
              )}
              <div className="absolute inset-0 flex flex-col justify-end bg-[linear-gradient(to_top,rgba(13,27,42,0.9),rgba(13,27,42,0.25)_55%,transparent)] p-4">
                <h3 className="heading text-[1.05rem] font-bold text-white">{door.label}</h3>
                <span className="mt-0.5 text-[0.74rem] text-[color:var(--brand-pale-gold)]">
                  {door.countLabel}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
