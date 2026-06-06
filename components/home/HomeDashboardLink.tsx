"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { ChevronRight } from "lucide-react";

/** Optional dashboard CTA on the home hero — avoids blocking the page on server auth(). */
export function HomeDashboardLink() {
  const { isLoaded, isSignedIn } = useAppUser();
  const t = useTranslations("common");
  if (!isLoaded) {
    return <span className="inline-flex h-[46px] min-w-[8.5rem] shrink-0" aria-hidden />;
  }
  if (!isSignedIn) return null;

  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-2 rounded-[6px] border border-white/25 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
    >
      {t("dashboard")}
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}
