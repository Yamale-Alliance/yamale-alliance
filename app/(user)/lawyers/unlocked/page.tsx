"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Mail, Phone } from "lucide-react";

type UnlockedLawyer = {
  id: string;
  name: string;
  country: string;
  expertise: string;
  linkedinUrl: string | null;
  imageUrl: string | null;
  email: string | null;
  phone: string | null;
  contacts: string | null;
};

export default function UnlockedLawyersPage() {
  const [loading, setLoading] = useState(true);
  const [lawyers, setLawyers] = useState<UnlockedLawyer[]>([]);

  useEffect(() => {
    fetch("/api/lawyers/unlocked-list", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data: { lawyers?: UnlockedLawyer[] }) => {
        setLawyers(Array.isArray(data.lawyers) ? data.lawyers : []);
      })
      .catch(() => setLawyers([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border/40 bg-gradient-to-b from-muted/20 to-background">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Lawyers Directory</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Unlocked lawyers</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Lawyers whose contact details you have already paid to unlock.
          </p>
          <div className="mt-4">
            <Link
              href="/lawyers"
              className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary/60 hover:bg-primary/5"
            >
              Back to lawyers search
            </Link>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : lawyers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-card/90 p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No unlocked lawyers yet. Unlock a search from the{" "}
                <Link href="/lawyers" className="font-semibold text-foreground underline">
                  lawyers page
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {lawyers.map((lawyer) => (
                <article key={lawyer.id} className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-bold text-foreground">
                      {lawyer.imageUrl ? (
                        <Image src={lawyer.imageUrl} alt={lawyer.name} width={64} height={64} className="h-full w-full object-cover" />
                      ) : (
                        lawyer.name
                          .split(" ")
                          .map((n) => n[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join("")
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-semibold text-foreground">{lawyer.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{lawyer.expertise}</p>
                      <p className="mt-1 text-xs text-muted-foreground">📍 {lawyer.country || "Country not specified"}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    {lawyer.email && (
                      <div className="flex items-center gap-2 text-foreground">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${lawyer.email}`} className="font-medium underline hover:opacity-80">
                          {lawyer.email}
                        </a>
                      </div>
                    )}
                    {lawyer.phone && (
                      <div className="flex items-center gap-2 text-foreground">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${lawyer.phone}`} className="font-medium underline hover:opacity-80">
                          {lawyer.phone}
                        </a>
                      </div>
                    )}
                    {lawyer.contacts && (
                      <div className="text-foreground">
                        <span className="font-medium">Other contacts: </span>
                        <span className="whitespace-pre-wrap">{lawyer.contacts}</span>
                      </div>
                    )}
                    {lawyer.linkedinUrl && (
                      <a
                        href={lawyer.linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex text-sm font-medium text-primary underline"
                      >
                        View LinkedIn profile
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
