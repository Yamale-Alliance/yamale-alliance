"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Star, Lock, Mail, Phone } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

type Lawyer = {
  id: string;
  name: string;
  specialty: string;
  country: string;
  rating: number;
  email: string;
  phone: string;
};

const MOCK_LAWYERS: Lawyer[] = [
  { id: "1", name: "Dr. Kofi Mensah", specialty: "Commercial Law", country: "Ghana", rating: 4.8, email: "k.mensah@legal-gh.com", phone: "+233 24 123 4567" },
  { id: "2", name: "Amara Okonkwo", specialty: "Corporate & M&A", country: "Nigeria", rating: 4.6, email: "a.okonkwo@lagoslegal.ng", phone: "+234 801 234 5678" },
  { id: "3", name: "Jane Wanjiku", specialty: "Labour & Employment", country: "Kenya", rating: 4.7, email: "j.wanjiku@nairobi-law.co.ke", phone: "+254 700 123 456" },
  { id: "4", name: "Thabo Molefe", specialty: "Dispute Resolution", country: "South Africa", rating: 4.9, email: "t.molefe@johannesburglegal.co.za", phone: "+27 11 234 5678" },
  { id: "5", name: "Fatou Diallo", specialty: "OHADA & Business", country: "Senegal", rating: 4.5, email: "f.diallo@cabinet-dakar.sn", phone: "+221 33 123 45 67" },
  { id: "6", name: "Emmanuel Nkrumah", specialty: "AfCFTA & Trade", country: "Ghana", rating: 4.6, email: "e.nkrumah@tradelegal-gh.com", phone: "+233 20 987 6543" },
  { id: "7", name: "Grace Mwangi", specialty: "Data Protection", country: "Kenya", rating: 4.4, email: "g.mwangi@techlaw.co.ke", phone: "+254 722 456 789" },
  { id: "8", name: "Ibrahim Sow", specialty: "Mining & Natural Resources", country: "Mali", rating: 4.7, email: "i.sow@bamako-legal.ml", phone: "+223 20 12 34 56" },
];

type UnlockOption = "per_lawyer" | "day_pass";

const PER_LAWYER_PRICE = 5;
const DAY_PASS_PRICE = 25;

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  return (
    <span className="flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < full ? "fill-current" : ""}`} />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </span>
  );
}

function UnlockPaymentDialog({
  lawyer,
  open,
  onOpenChange,
  onSuccess,
}: {
  lawyer: Lawyer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (lawyerId: string) => void;
}) {
  const { userId } = useAuth();
  const [option, setOption] = useState<UnlockOption>("per_lawyer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = option === "per_lawyer" ? PER_LAWYER_PRICE : DAY_PASS_PRICE;

  const handleConfirm = async () => {
    if (!lawyer) return;
    if (!userId) {
      setError("Sign in to unlock contact.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lawyers/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawyerId: lawyer.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to unlock");
        return;
      }
      onSuccess(lawyer.id);
      onOpenChange(false);
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
            {lawyer.name} · {lawyer.specialty}
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

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Payment method</label>
            <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option>Card (Visa, Mastercard)</option>
              <option>Mobile money (MTN, Airtel, Orange)</option>
              <option>Bank transfer</option>
            </select>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Payment integration coming soon. Unlock is recorded for demo.
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
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [paymentLawyer, setPaymentLawyer] = useState<Lawyer | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  useEffect(() => {
    fetch("/api/lawyers/unlocked")
      .then((res) => res.json())
      .then((data: { lawyerIds?: string[] }) => {
        if (Array.isArray(data.lawyerIds)) {
          setUnlockedIds(new Set(data.lawyerIds));
        }
      })
      .catch(() => {});
  }, []);

  const handleUnlockSuccess = (lawyerId: string) => {
    setUnlockedIds((prev) => new Set(prev).add(lawyerId));
  };

  return (
    <div className="min-h-screen">
      {/* Payment options banner */}
      <div className="border-b border-border bg-primary/10 px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-medium text-foreground">
            Unlock lawyer contact: <strong>$5</strong> per lawyer or{" "}
            <strong>$25</strong> day pass (all lawyers, 24h)
          </p>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Secure payment · Card or mobile money
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="border-b border-border bg-card/50 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            Find a Lawyer
          </h1>
          <p className="mt-1 text-muted-foreground">
            Verified legal professionals across Africa. Unlock contact to get in
            touch.
          </p>
        </div>
      </div>

      {/* Lawyer grid */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_LAWYERS.map((lawyer) => {
            const isUnlocked = unlockedIds.has(lawyer.id);
            return (
              <article
                key={lawyer.id}
                className="flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/30"
              >
                <h2 className="font-semibold text-foreground">{lawyer.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lawyer.specialty} · {lawyer.country}
                </p>
                <div className="mt-2">
                  <RatingStars rating={lawyer.rating} />
                </div>
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {isUnlocked ? (
                      <a
                        href={`mailto:${lawyer.email}`}
                        className="text-foreground underline hover:opacity-80"
                      >
                        {lawyer.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">
                        ••••••@••••.•••
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {isUnlocked ? (
                      <a
                        href={`tel:${lawyer.phone}`}
                        className="text-foreground underline hover:opacity-80"
                      >
                        {lawyer.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">••••••••••••</span>
                    )}
                  </div>
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
