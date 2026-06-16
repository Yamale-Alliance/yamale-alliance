"use client";

import {
  BookOpen,
  GraduationCap,
  FileText,
  Gift,
  LayoutGrid,
  ArrowRight,
  Layers,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { VAULT_BROWSE_FREE, VAULT_BROWSE_SERIES } from "@/lib/marketplace-vault-categories";

type CategoryParam =
  | "all"
  | "book"
  | "course"
  | "template"
  | "guide"
  | typeof VAULT_BROWSE_FREE
  | typeof VAULT_BROWSE_SERIES;

type VaultCategoryGridProps = {
  categories: {
    param: CategoryParam;
    label: string;
    blurb: string;
    count: number;
  }[];
  onSelectCategory: (param: CategoryParam) => void;
};

const CATEGORY_ACCENTS: Record<string, string> = {
  free: "from-emerald-500/20 to-emerald-600/5 text-emerald-700 dark:text-emerald-300",
  series: "from-violet-500/20 to-violet-600/5 text-violet-700 dark:text-violet-300",
  course: "from-sky-500/20 to-sky-600/5 text-sky-700 dark:text-sky-300",
  template: "from-slate-500/20 to-slate-600/5 text-slate-700 dark:text-slate-300",
  book: "from-amber-500/20 to-amber-600/5 text-amber-800 dark:text-amber-300",
  guide: "from-teal-500/20 to-teal-600/5 text-teal-700 dark:text-teal-300",
};

function CategoryIcon({ param }: { param: CategoryParam }) {
  const className = "h-6 w-6";
  switch (param) {
    case "all":
      return <LayoutGrid className={className} />;
    case VAULT_BROWSE_FREE:
      return <Gift className={className} />;
    case VAULT_BROWSE_SERIES:
      return <Layers className={className} />;
    case "book":
    case "guide":
      return <BookOpen className={className} />;
    case "course":
      return <GraduationCap className={className} />;
    case "template":
      return <FileText className={className} />;
    default:
      return <LayoutGrid className={className} />;
  }
}

export function VaultCategoryGrid({ categories, onSelectCategory }: VaultCategoryGridProps) {
  const t = useTranslations("marketplace");

  return (
    <section className="border-b border-border/60 bg-gradient-to-b from-card to-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("landing.exploreCategories")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {t("landing.exploreCategoriesHint")}
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories
            .filter((c) => c.param !== "all")
            .map((category) => {
              const accent =
                CATEGORY_ACCENTS[category.param] ??
                "from-[#C8922A]/20 to-[#C8922A]/5 text-[#9a632a]";
              return (
                <button
                  key={category.param}
                  type="button"
                  onClick={() => onSelectCategory(category.param)}
                  className="group flex w-full items-start gap-4 rounded-2xl border border-border/80 bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#C8922A]/40 hover:shadow-lg"
                >
                  <span
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent}`}
                  >
                    <CategoryIcon param={category.param} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-base font-semibold text-foreground">{category.label}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#C8922A] opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                      {category.blurb}
                    </span>
                    {category.count > 0 && (
                      <span className="mt-3 inline-flex rounded-full bg-[#C8922A]/10 px-2.5 py-0.5 text-xs font-semibold text-[#9a632a]">
                        {t("landing.resourceCount", { count: category.count })}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    </section>
  );
}
