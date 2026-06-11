"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

type Variant = "user" | "admin";

export function SupportComingSoon({ variant = "user" }: { variant?: Variant }) {
  const t = useTranslations("accountSupport");

  if (variant === "admin") {
    return (
      <div className="rounded-xl border border-border bg-muted/30 px-6 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("adminComingSoon")}
        </p>
        <h1 className="heading mt-2 text-2xl font-bold text-foreground">{t("adminQueueTitle")}</h1>
        <p className="mt-3 max-w-lg text-muted-foreground">
          {t.rich("adminDesc", {
            code: (chunks) => (
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{chunks}</code>
            ),
          })}
        </p>
        <p className="mt-4">
          <Link href="/admin-panel" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("adminBack")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 px-6 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("comingSoon")}</p>
      <h1 className="heading mt-2 text-2xl font-bold text-foreground">{t("centreTitle")}</h1>
      <p className="mt-3 max-w-lg text-muted-foreground">
        {t.rich("comingSoonDesc", {
          account: (chunks) => (
            <Link href="/account" className="font-medium text-primary underline-offset-4 hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
