"use client";

import { createContext, useContext } from "react";
import {
  ClerkProvider,
  useAuth as useClerkAuth,
  useUser as useClerkUser,
} from "@clerk/nextjs";
import { CLERK_PUBLISHABLE_KEY, isClerkConfigured } from "@/lib/clerk-config";
import { yamaleClerkAppearance } from "@/lib/clerk-appearance";

type AppUserState = ReturnType<typeof useClerkUser>;
type AppAuthState = ReturnType<typeof useClerkAuth>;

const GUEST_USER = {
  isLoaded: true,
  isSignedIn: false,
  user: null,
} satisfies AppUserState;

const GUEST_AUTH = {
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  sessionId: null,
  sessionClaims: null,
  actor: null,
  orgId: null,
  orgRole: null,
  orgSlug: null,
  has: () => false,
  signOut: async () => {},
  getToken: async () => null,
} as AppAuthState;

const AppUserContext = createContext<AppUserState>(GUEST_USER);
const AppAuthContext = createContext<AppAuthState>(GUEST_AUTH);

function ClerkAuthBridge({ children }: { children: React.ReactNode }) {
  const user = useClerkUser();
  const auth = useClerkAuth();
  return (
    <AppUserContext.Provider value={user}>
      <AppAuthContext.Provider value={auth}>{children}</AppAuthContext.Provider>
    </AppUserContext.Provider>
  );
}

/** Clerk when configured; guest auth state for local prod builds without keys. */
export function AppAuthProvider({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured()) {
    return (
      <AppUserContext.Provider value={GUEST_USER}>
        <AppAuthContext.Provider value={GUEST_AUTH}>{children}</AppAuthContext.Provider>
      </AppUserContext.Provider>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} appearance={yamaleClerkAppearance}>
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}

export function useAppUser(): AppUserState {
  return useContext(AppUserContext);
}

export function useAppAuth(): AppAuthState {
  return useContext(AppAuthContext);
}
