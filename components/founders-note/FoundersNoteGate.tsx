"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { FoundersNoteDialog } from "@/components/founders-note/FoundersNoteDialog";
import {
  readFoundersNoteSeenFromStorage,
  shouldSkipFoundersNoteAutoPrompt,
  writeFoundersNoteSeenToStorage,
} from "@/lib/founders-note";

function storageKeyForUser(userId: string | null | undefined): string {
  return userId ?? "guest";
}

export function FoundersNoteGate() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const markedSeenRef = useRef(false);

  const markSeen = useCallback(async () => {
    if (markedSeenRef.current) return;
    markedSeenRef.current = true;
    const key = storageKeyForUser(user?.id);
    writeFoundersNoteSeenToStorage(key);
    if (user?.id) {
      try {
        await fetch("/api/user/founders-note", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // localStorage is enough for UX
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isLoaded || checked) return;
    if (shouldSkipFoundersNoteAutoPrompt(pathname)) {
      setChecked(true);
      return;
    }

    const key = storageKeyForUser(user?.id);
    if (readFoundersNoteSeenFromStorage(key)) {
      setChecked(true);
      return;
    }

    let cancelled = false;

    const run = async () => {
      if (user?.id) {
        try {
          const res = await fetch("/api/user/founders-note", { credentials: "include" });
          if (res.ok) {
            const data = (await res.json()) as { seen?: boolean };
            if (data.seen) {
              writeFoundersNoteSeenToStorage(key);
              if (!cancelled) setChecked(true);
              return;
            }
          }
        } catch {
          // fall through to show dialog
        }
      }
      if (!cancelled) {
        setOpen(true);
        setChecked(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, checked, pathname, user?.id]);

  const handleContinue = useCallback(() => {
    void markSeen();
    setOpen(false);
  }, [markSeen]);

  if (!checked && !open) return null;

  return (
    <FoundersNoteDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleContinue();
        else setOpen(true);
      }}
      onContinue={handleContinue}
    />
  );
}
