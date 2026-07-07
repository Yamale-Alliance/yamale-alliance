"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";

export function LayoutContentArea({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin-panel");

  return (
    <div
      className={
        isAdmin
          ? "flex h-0 min-h-0 min-w-0 flex-1 flex-col overflow-hidden max-md:min-h-0 md:flex-none"
          : "flex min-h-0 min-w-0 flex-1 flex-col"
      }
    >
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}
