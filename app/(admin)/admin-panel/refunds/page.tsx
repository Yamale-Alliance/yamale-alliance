import { getTranslations } from "next-intl/server";
import { AdminRefundsPanel } from "@/components/admin/refunds/AdminRefundsPanel";

export default async function AdminRefundsPage() {
  const t = await getTranslations("admin.refunds");

  return (
    <div className="p-4 sm:p-6">
      <h1 className="heading text-2xl font-bold">{t("title")}</h1>
      <div className="mt-6">
        <AdminRefundsPanel />
      </div>
    </div>
  );
}
