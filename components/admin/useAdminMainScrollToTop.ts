"use client";

import { useEffect } from "react";

import { getAdminWorkspaceMain } from "@/lib/admin-workspace-scroll";

/** Resets the admin shell scroll container when switching focused views (add/edit forms). */
export function useAdminMainScrollToTop(...deps: unknown[]) {
  useEffect(() => {
    getAdminWorkspaceMain()?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional dep list from caller
  }, deps);
}
