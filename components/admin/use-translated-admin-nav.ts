"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { adminNavItemDefs } from "./admin-nav-config";

export function useTranslatedAdminNavItems() {
  const t = useTranslations("admin.nav");

  return useMemo(
    () =>
      adminNavItemDefs.map(({ href, labelKey, icon }) => ({
        href,
        label: t(labelKey),
        icon,
      })),
    [t]
  );
}
