"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { userNavLinkDefs } from "./nav-config";

export function useTranslatedUserNavLinks() {
  const t = useTranslations("nav");
  const { user } = useAppUser();
  const tier = (user?.publicMetadata?.tier ?? user?.publicMetadata?.subscriptionTier ?? "free") as string;
  const isTeam = tier === "team";

  return useMemo(
    () =>
      userNavLinkDefs
        .filter((link) => !link.teamOnly || isTeam)
        .map(({ href, labelKey, icon, teamOnly }) => ({
          href,
          label: t(labelKey),
          icon,
          teamOnly,
        })),
    [isTeam, t]
  );
}

export function useTranslatedGuestNavLinks() {
  const t = useTranslations("nav");

  return useMemo(
    () =>
      userNavLinkDefs.map(({ href, labelKey, icon }) => ({
        href,
        label: t(labelKey),
        icon,
      })),
    [t]
  );
}
