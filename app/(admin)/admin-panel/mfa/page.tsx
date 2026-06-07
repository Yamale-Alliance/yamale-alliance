import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminMfaPanel } from "@/components/admin/AdminMfaPanel";

export default async function AdminMfaPage() {
  const t = await getTranslations("admin.common");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          {t("loading")}
        </div>
      }
    >
      <AdminMfaPanel />
    </Suspense>
  );
}
