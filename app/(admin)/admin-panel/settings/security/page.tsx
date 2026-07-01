import { AdminSecuritySettingsPanel } from "@/components/admin/AdminSecuritySettingsPanel";

export const dynamic = "force-dynamic";

export default function AdminSecuritySettingsPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <AdminSecuritySettingsPanel />
    </div>
  );
}
