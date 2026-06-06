"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function AccountBackLink() {
  const t = useTranslations("common");

  return (
    <Link href="/account" className="text-sm font-medium text-primary hover:underline">
      {t("backToAccount")}
    </Link>
  );
}
