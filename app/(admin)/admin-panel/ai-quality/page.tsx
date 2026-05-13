import { Suspense } from "react";
import { AdminAiModerationHub } from "@/components/admin/AdminAiModerationHub";

function Fallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

export default function AdminAiQualityPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <AdminAiModerationHub />
    </Suspense>
  );
}
