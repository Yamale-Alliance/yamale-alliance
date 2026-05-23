import { AdminRefundsPanel } from "@/components/admin/refunds/AdminRefundsPanel";

export default function AdminRefundsPage() {
  return (
    <div className="p-4 sm:p-6">
      <h1 className="heading text-2xl font-bold">Refund requests</h1>
      <div className="mt-6">
        <AdminRefundsPanel />
      </div>
    </div>
  );
}
