"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { LogOut, Settings, Shield, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AccountAvatarMenuProps = {
  afterSignOutUrl?: string;
};

/** Site-themed account control — links to /account instead of Clerk's modal. */
export function AccountAvatarMenu({ afterSignOutUrl = "/" }: AccountAvatarMenuProps) {
  const { user } = useAppUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (!user) return null;

  const isAdmin = (user.publicMetadata?.role as string | undefined) === "admin";

  const initials =
    [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join("") ||
    user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
    "?";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/50 ring-offset-background transition hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        {user.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-foreground">{initials}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          <p className="truncate border-b border-border px-3 py-2 text-xs text-muted-foreground">
            {user.primaryEmailAddress?.emailAddress}
          </p>
          <Link
            href="/account"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground transition hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Account
          </Link>
          <Link
            href="/account/profile"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground transition hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Profile & security
          </Link>
          {isAdmin && (
            <Link
              href="/admin-panel"
              role="menuitem"
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground transition hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              <Shield className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Admin panel
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-muted"
            onClick={() => {
              setOpen(false);
              void signOut({ redirectUrl: afterSignOutUrl });
            }}
          >
            <LogOut className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
