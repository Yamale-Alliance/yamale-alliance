import { Suspense } from "react";
import { AdminRevenueHub } from "@/components/admin/AdminRevenueHub";

function RevenueFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <p className="text-sm text-muted-foreground">Loading revenue hub…</p>
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
