"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AdminSessionResponse } from "@/app/api/admin/session/route";
import { canEditLaw } from "@/lib/admin-roles";

type AdminRoleContextValue = {
  session: AdminSessionResponse | null;
  loading: boolean;
  isFullAdmin: boolean;
  isLegalAdmin: boolean;
  canDeleteLaws: boolean;
  canApproveRag: boolean;
  canEditLaw: (ingestedBy: string | null | undefined) => boolean;
  refresh: () => Promise<void>;
};

const AdminRoleContext = createContext<AdminRoleContextValue | null>(null);

export function AdminRoleProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/session", { credentials: "include" });
      if (!res.ok) {
        setSession(null);
        return;
      }
      const data = (await res.json()) as AdminSessionResponse;
      setSession(data);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AdminRoleContextValue>(() => {
    const isFullAdmin = session?.permissions.isFullAdmin ?? false;
    const isLegalAdmin = session?.role === "legal_admin";
    return {
      session,
      loading,
      isFullAdmin,
      isLegalAdmin,
      canDeleteLaws: session?.permissions.canDeleteLaws ?? false,
      canApproveRag: session?.permissions.canApproveRag ?? false,
      canEditLaw: (ingestedBy) =>
        session ? canEditLaw(session.role, session.userId, ingestedBy) : false,
      refresh,
    };
  }, [session, loading, refresh]);

  return <AdminRoleContext.Provider value={value}>{children}</AdminRoleContext.Provider>;
}

export function useAdminRole() {
  const ctx = useContext(AdminRoleContext);
  if (!ctx) {
    throw new Error("useAdminRole must be used within AdminRoleProvider");
  }
  return ctx;
}
