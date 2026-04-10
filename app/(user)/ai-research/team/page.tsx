"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  Users,
  Plus,
  Trash2,
  ArrowLeft,
  CreditCard,
} from "lucide-react";
import { useConfirm } from "@/components/ui/use-confirm";

type Member = { userId: string; email: string; addedAt: string };

export default function ManageTeamPage() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [seatsUsed, setSeatsUsed] = useState(0);
  const [seatsTotal, setSeatsTotal] = useState(5);
  const [canAddMore, setCanAddMore] = useState(false);
  const [needExtraSeats, setNeedExtraSeats] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraSeats, setExtraSeats] = useState(1);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmedRef = useRef<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const metadata = user?.publicMetadata as Record<string, unknown> | undefined;
  const tier = (metadata?.tier ?? metadata?.subscriptionTier) as string | undefined;
  const teamAdmin = tier === "team"; // Paying account has tier "team" in their metadata; only they can manage

  useEffect(() => {
    if (!user) return;
    if (!teamAdmin) {
      setLoading(false);
      return;
    }
    fetch("/api/team/members", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          if (data.error === "Team admin only") {
            setError(null);
            setSeatsTotal(5);
            setSeatsUsed(0);
            setCanAddMore(true);
            setNeedExtraSeats(false);
          } else {
            setError(data.error);
          }
          return;
        }
        setError(null);
        setMembers(data.members ?? []);
        setSeatsUsed(data.seatsUsed ?? 0);
        setSeatsTotal(data.seatsTotal ?? 5);
        setCanAddMore(data.canAddMore ?? false);
        setNeedExtraSeats(data.needExtraSeats ?? false);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [user, teamAdmin]);

  const refetchTeam = useCallback(() => {
    fetch("/api/team/members", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setMembers(data.members ?? []);
          setSeatsUsed(data.seatsUsed ?? 0);
          setSeatsTotal(data.seatsTotal ?? 5);
          setCanAddMore(data.canAddMore ?? false);
          setNeedExtraSeats(data.needExtraSeats ?? false);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId || confirming || confirmedRef.current === sessionId) return;
    confirmedRef.current = sessionId;
    setConfirming(true);
    fetch("/api/team/confirm-extra-seats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          window.history.replaceState({}, "", "/ai-research/team");
          refetchTeam();
        }
      })
      .catch(() => {})
      .finally(() => setConfirming(false));
  }, [searchParams, refetchTeam]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/team/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: addEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add");
        if (data.needExtraSeats) {
          setNeedExtraSeats(true);
          setCanAddMore(false);
        }
        return;
      }
      setMembers((prev) => [
        ...prev,
        { userId: data.member.userId, email: data.member.email || addEmail.trim(), addedAt: new Date().toISOString() },
      ]);
      setSeatsUsed((prev) => prev + 1);
      setCanAddMore(seatsUsed + 1 < seatsTotal);
      setAddEmail("");
    } catch {
      setError("Something went wrong");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    const ok = await confirm({
      title: "Remove member",
      description: "Remove this member from your team?",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) return;
      setMembers((prev) => prev.filter((m) => m.userId !== memberId));
      setSeatsUsed((prev) => prev - 1);
      setCanAddMore(true);
      setNeedExtraSeats(false);
    } catch {
      setError("Failed to remove");
    }
  };

  const handleBuySeats = async () => {
    const n = Math.min(Math.max(1, extraSeats), 50);
    setCheckoutLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/team-extra-seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ seats: n }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Checkout failed");
    } catch {
      setError("Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Sign in to manage your team.</p>
      </div>
    );
  }

  if (!teamAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Manage team</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Only the account that pays for the Team plan can add or remove members.
          </p>
          <Link
            href="/ai-research"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to AI Research
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/ai-research"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> AI Research
        </Link>
      </div>

      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <Users className="h-6 w-6" />
        Manage team
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Add up to {seatsTotal} members to use AI Research on your Team plan. You are the admin (account that pays).
      </p>

      {confirming && (
        <p className="mt-4 text-sm text-muted-foreground">Confirming payment…</p>
      )}

      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <p className="text-sm font-medium">
          Seats: {seatsUsed} / {seatsTotal} used
        </p>

        <ul className="mt-4 space-y-2">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"
            >
              <span className="text-sm">{m.email || m.userId}</span>
              <button
                type="button"
                onClick={() => void handleRemove(m.userId)}
                className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {members.length === 0 && (
            <li className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No members yet. Add someone by email below.
            </li>
          )}
        </ul>

        {teamAdmin && seatsUsed < seatsTotal && (
          <form onSubmit={handleAddMember} className="mt-4 flex gap-2">
            <input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="Teammate email"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              disabled={adding}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
          </form>
        )}

        {needExtraSeats && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">No seats left</p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              Add more seats for $6 each. How many do you need?
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                type="number"
                min={1}
                max={50}
                value={extraSeats}
                onChange={(e) => setExtraSeats(Number(e.target.value) || 1)}
                className="w-20 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleBuySeats}
                disabled={checkoutLoading}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" />
                {checkoutLoading ? "Redirecting…" : `Pay $${extraSeats * 6}`}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Members must have a Yamalé account (sign up with the email you add). They will get Team-level AI access.
      </p>
      {confirmDialog}
    </div>
  );
}
