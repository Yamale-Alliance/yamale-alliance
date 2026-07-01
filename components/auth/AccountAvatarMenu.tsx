"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { ADMIN_ROLE, LEGAL_ADMIN_ROLE } from "@/lib/admin-roles";
import { LogOut, Settings, Shield, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AccountAvatarMenuProps = {
  afterSignOutUrl?: string;
};

/** Site-themed account control — links to /account instead of Clerk's modal. */
export function AccountAvatarMenu({ afterSignOutUrl = "/" }: AccountAvatarMenuProps) {
  const { user } = useAppUser();
  const { signOut } = useClerk();
  const t = useTranslations("accountMenu");
  const tCommon = useTranslations("common");
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

  const role = user.publicMetadata?.role as string | undefined;
  const showAdminPanel = role === ADMIN_ROLE || role === LEGAL_ADMIN_ROLE;
  const adminPanelHref = role === LEGAL_ADMIN_ROLE ? "/admin-panel/laws" : "/admin-panel";

  const handleSignOut = async () => {
    setOpen(false);
    // Admins/legal admins: clear the app-level MFA step-up so re-login requires the code again.
    if (showAdminPanel) {
      try {
        await fetch("/api/admin/mfa", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "logout" }),
        });
      } catch {
        // Best effort — proceed with sign-out regardless.
      }
    }
    await signOut({ redirectUrl: afterSignOutUrl });
  };

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
        aria-label={t("menu")}
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
            {tCommon("account")}
          </Link>
          <Link
            href="/account/profile"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground transition hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {t("profileSecurity")}
          </Link>
          {showAdminPanel && (
            <Link
              href={adminPanelHref}
              role="menuitem"
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground transition hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              <Shield className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {t("adminPanel")}
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-muted"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
