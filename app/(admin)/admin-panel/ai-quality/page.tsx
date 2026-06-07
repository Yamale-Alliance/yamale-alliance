import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminAiModerationHub } from "@/components/admin/AdminAiModerationHub";

export default async function AdminAiQualityPage() {
  const t = await getTranslations("admin.common");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      }
    >
      <AdminAiModerationHub />
    </Suspense>
  );
}
