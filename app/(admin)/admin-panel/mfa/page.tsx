import { Suspense } from "react";
import { AdminMfaPanel } from "@/components/admin/AdminMfaPanel";

export default function AdminMfaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AdminMfaPanel />
    </Suspense>
  );
}
