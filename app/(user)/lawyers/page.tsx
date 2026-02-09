"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Lock, Loader2, ShieldCheck, Linkedin, Mail, Phone, Clock } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

type Lawyer = {
  id: string;
  name: string;
  country: string;
  expertise: string;
  linkedinUrl: string | null;
};

type UnlockOption = "per_lawyer" | "day_pass";

const PER_LAWYER_PRICE = 5;
const DAY_PASS_PRICE = 25;

function UnlockPaymentDialog({
  lawyer,
  open,
  onOpenChange,
  onSuccess,
}: {
  lawyer: Lawyer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (lawyerId?: string, dayPass?: boolean) => void;
}) {
  const { user, isLoaded, isSignedIn } = useUser();
  const [option, setOption] = useState<UnlockOption>("per_lawyer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = option === "per_lawyer" ? PER_LAWYER_PRICE : DAY_PASS_PRICE;

  const handleConfirm = async () => {
    if (!lawyer) return;
    if (!isLoaded || !isSignedIn || !user?.id) {
      setError("Sign in to unlock contact.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (option === "day_pass") {
        const res = await fetch("/api/stripe/day-pass", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Failed to start checkout");
          return;
        }
        if (data.url) {
          onSuccess(undefined, true);
          onOpenChange(false);
          window.location.href = data.url;
          return;
        }
      } else {
        const res = await fetch("/api/stripe/lawyer-unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lawyerId: lawyer.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Failed to start checkout");
          return;
        }
        if (data.url) {
          onSuccess(lawyer.id, false);
          onOpenChange(false);
          window.location.href = data.url;
          return;
        }
      }
      setError("Checkout could not be started.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!lawyer) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold">Unlock contact</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {lawyer.name} · {lawyer.expertise}
          </Dialog.Description>

          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium">Choose option</p>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/50">
              <span className="text-sm">$5 — Unlock this lawyer</span>
              <input
                type="radio"
                name="unlock-option"
                checked={option === "per_lawyer"}
                onChange={() => setOption("per_lawyer")}
                className="h-4 w-4"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/50">
              <span className="text-sm">$25 — Day pass (unlock all lawyers for 24h)</span>
              <input
                type="radio"
                name="unlock-option"
                checked={option === "day_pass"}
                onChange={() => setOption("day_pass")}
                className="h-4 w-4"
              />
            </label>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-semibold">${price}</span>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            You will be redirected to Stripe to pay securely. Day pass unlocks all lawyers for 24 hours from purchase.
          </p>

          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="mt-6 flex gap-3">
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Unlocking…" : "Confirm & unlock"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function LawyersPage() {
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [lawyersLoading, setLawyersLoading] = useState(true);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [contactsByLawyer, setContactsByLawyer] = useState<Record<string, { email: string | null; phone: string | null; contacts: string | null }>>({});
  const [dayPassActive, setDayPassActive] = useState(false);
  const [dayPassExpiresAt, setDayPassExpiresAt] = useState<string | null>(null);
  const [paymentLawyer, setPaymentLawyer] = useState<Lawyer | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const searchParams = useSearchParams();
  const confirmedSessionRef = useRef<string | null>(null);

  const refetchUnlocked = () => {
    fetch("/api/lawyers/unlocked", { credentials: "include" })
      .then((res) => res.json())
      .then((data: {
        lawyerIds?: string[];
        dayPassActive?: boolean;
        dayPassExpiresAt?: string | null;
        contacts?: Record<string, { email: string | null; phone: string | null; contacts: string | null }>;
      }) => {
        if (Array.isArray(data.lawyerIds)) setUnlockedIds(new Set(data.lawyerIds));
        setDayPassActive(Boolean(data.dayPassActive));
        setDayPassExpiresAt(data.dayPassExpiresAt ?? null);
        setContactsByLawyer((data.contacts ?? {}) as Record<string, { email: string | null; phone: string | null; contacts: string | null }>);
      })
      .catch(() => {});
  };

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId || confirmingPayment || confirmedSessionRef.current === sessionId) return;
    confirmedSessionRef.current = sessionId;
    setConfirmingPayment(true);
    fetch("/api/lawyers/confirm-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          refetchUnlocked();
          window.history.replaceState({}, "", "/lawyers");
        }
      })
      .catch(() => {})
      .finally(() => setConfirmingPayment(false));
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/lawyers")
      .then((res) => res.json())
      .then((data: { lawyers?: Lawyer[] }) => {
        setLawyers(Array.isArray(data.lawyers) ? data.lawyers : []);
      })
      .catch(() => setLawyers([]))
      .finally(() => setLawyersLoading(false));
  }, []);

  useEffect(() => {
    refetchUnlocked();
  }, []);

  const handleUnlockSuccess = (lawyerId?: string, dayPass?: boolean) => {
    if (dayPass) {
      setDayPassActive(true);
    } else if (lawyerId) {
      setUnlockedIds((prev) => new Set(prev).add(lawyerId));
    }
    if (lawyerId || dayPass) refetchUnlocked();
  };

  return (
    <div className="min-h-screen">
      {/* Payment options banner */}
      <div className="border-b border-border bg-primary/10 px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-foreground">
              {dayPassActive ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                    <Clock className="h-3.5 w-3.5" /> Day pass active
                  </span>
                  {dayPassExpiresAt && (
                    <span className="text-muted-foreground">
                      — Expires {new Date(dayPassExpiresAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  )}
                </>
              ) : (
                <>
                  Unlock lawyer contact: <strong>$5</strong> per lawyer or{" "}
                  <strong>$25</strong> day pass (all lawyers, 24h)
                </>
              )}
            </p>
            {confirmingPayment && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Confirming payment…
              </span>
            )}
          </div>
          {!dayPassActive && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Secure payment · Card or mobile money
            </span>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="border-b border-border bg-card/50 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            Find a Lawyer
          </h1>
          <p className="mt-1 text-muted-foreground">
            Legal professionals across Africa. Unlock contact to get in touch.
          </p>
        </div>
      </div>

      {/* Lawyer grid */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {lawyersLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : lawyers.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            No verified lawyers in the directory yet. Check back later.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lawyers.map((lawyer) => {
              const isUnlocked = dayPassActive || unlockedIds.has(lawyer.id);
              return (
                <article
                  key={lawyer.id}
                  className="flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/30"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-full border border-border bg-muted flex items-center justify-center">
                      <span className="text-sm font-medium text-muted-foreground">
                        {lawyer.name
                          .split(" ")
                          .map((n) => n[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-foreground">{lawyer.name}</h2>
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                          <ShieldCheck className="h-3 w-3" /> Listed
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {lawyer.expertise}
                        {lawyer.country ? ` · ${lawyer.country}` : ""}
                      </p>
                      {lawyer.linkedinUrl && (
                        <a
                          href={lawyer.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 border-t border-border pt-4">
                    {isUnlocked && contactsByLawyer[lawyer.id] ? (
                      <>
                        {contactsByLawyer[lawyer.id].email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <a href={`mailto:${contactsByLawyer[lawyer.id].email}`} className="text-foreground underline hover:opacity-80">
                              {contactsByLawyer[lawyer.id].email}
                            </a>
                          </div>
                        )}
                        {contactsByLawyer[lawyer.id].phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <a href={`tel:${contactsByLawyer[lawyer.id].phone}`} className="text-foreground underline hover:opacity-80">
                              {contactsByLawyer[lawyer.id].phone}
                            </a>
                          </div>
                        )}
                        {contactsByLawyer[lawyer.id].contacts && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contactsByLawyer[lawyer.id].contacts}</p>
                        )}
                        {!contactsByLawyer[lawyer.id].email && !contactsByLawyer[lawyer.id].phone && !contactsByLawyer[lawyer.id].contacts && (
                          <span className="text-sm text-muted-foreground">No contact details</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Contact hidden. Unlock to view.</span>
                    )}
                  </div>
                  {!isUnlocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentLawyer(lawyer);
                        setPaymentOpen(true);
                      }}
                      className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20"
                    >
                      <Lock className="h-4 w-4" />
                      Unlock contact
                    </button>
                  )}
                  {isUnlocked && (
                    <p className="mt-4 text-center text-xs text-green-600 dark:text-green-400">
                      Contact unlocked
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <UnlockPaymentDialog
        lawyer={paymentLawyer}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onSuccess={handleUnlockSuccess}
      />
    </div>
  );
}
