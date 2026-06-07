import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminRevenueHub } from "@/components/admin/AdminRevenueHub";

async function RevenueFallback() {
  const t = await getTranslations("admin.revenue");
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <p className="text-sm text-muted-foreground">{t("loadingFallback")}</p>
    </div>
  );
}

export default function AdminRevenuePage() {
  return (
    <Suspense fallback={<RevenueFallback />}>
      <AdminRevenueHub />
    </Suspense>
  );
}
