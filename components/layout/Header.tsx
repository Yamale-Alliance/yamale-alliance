"use client";

import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { GuestHeader } from "./GuestHeader";
import { UserHeader } from "./UserHeader";
import { LawyerHeader } from "./LawyerHeader";
import { AdminHeader } from "./AdminHeader";

type UserRole = "user" | "lawyer" | "admin";

export function Header() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return (
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="flex h-14 items-center justify-center px-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </header>
    );
  }

  if (!isSignedIn || !user) {
    return <GuestHeader />;
  }

  const role = user.publicMetadata?.role as UserRole | undefined;

  switch (role) {
    case "lawyer":
      return <LawyerHeader />;
    case "admin":
      return <AdminHeader />;
    case "user":
    default:
      return <UserHeader />;
  }
}
