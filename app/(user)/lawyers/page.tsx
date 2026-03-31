"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Search, Star, Loader2, Lock } from "lucide-react";

const BRAND = {
  dark: "#221913",
  medium: "#603b1c",
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
  accent: "#e3ba65",
};

type Lawyer = {
  id: string;
  name: string;
  country: string;
  expertise: string;
  linkedinUrl: string | null;
  imageUrl: string | null;
};

const SEARCH_PRICE = 5;

const EXPERTISE_OPTIONS = [
  "All Practice Areas",
  "Corporate Law",
  "Trade Law",
  "AfCFTA",
  "Intellectual Property",
  "Tax Law",
  "Litigation",
  "Employment Law",
  "M&A",
];

const LANGUAGE_OPTIONS = [
  "All Languages",
  "English",
  "French",
  "Arabic",
  "Portuguese",
  "Swahili",
  "Kinyarwanda",
  "Yoruba",
  "Wolof",
  "Twi",
];

// All African countries for search (user can select any; we show a message if none in directory).
const AFRICAN_COUNTRIES = [
  "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Cameroon",
  "Central African Republic", "Chad", "Comoros", "Congo", "Côte d'Ivoire", "Djibouti", "Egypt",
  "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea",
  "Guinea-Bissau", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali",
  "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda",
  "São Tomé and Príncipe", "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa",
  "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe",
];

export default function LawyersPage() {
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [contactsByLawyer, setContactsByLawyer] = useState<Record<string, { email: string | null; phone: string | null; contacts: string | null }>>({});
  const [reviewsByLawyer, setReviewsByLawyer] = useState<Record<string, { averageRating: number; totalReviews: number }>>({});
  const [dayPassActive, setDayPassActive] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState("all");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [hasSearched, setHasSearched] = useState(false);
  const [searchPayLoading, setSearchPayLoading] = useState(false);
  const [searchPayError, setSearchPayError] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const searchParams = useSearchParams();
  const confirmedSessionRef = useRef<string | null>(null);
  const { isLoaded: userLoaded, isSignedIn } = useUser();

  const refetchUnlocked = (): Promise<void> => {
    return fetch("/api/lawyers/unlocked", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { lawyerIds?: string[]; dayPassActive?: boolean; dayPassExpiresAt?: string | null; contacts?: Record<string, { email: string | null; phone: string | null; contacts: string | null }> }) => {
        if (Array.isArray(data.lawyerIds)) setUnlockedIds(new Set(data.lawyerIds));
        setDayPassActive(Boolean(data.dayPassActive));
        setContactsByLawyer((data.contacts ?? {}) as Record<string, { email: string | null; phone: string | null; contacts: string | null }>);
      })
      .catch(() => {});
  };

  const handlePayForSearch = async () => {
    if (selectedExpertise === "all") return;
    if (!userLoaded || !isSignedIn) {
      setSearchPayError("Sign in to unlock contact details.");
      return;
    }
    setSearchPayLoading(true);
    setSearchPayError(null);
    try {
      const res = await fetch("/api/stripe/lawyer-search-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: selectedCountry,
          expertise: selectedExpertise,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSearchPayError((data.error as string) || "Failed to start checkout");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setSearchPayError("Checkout could not be started.");
    } catch {
      setSearchPayError("Something went wrong. Try again.");
    } finally {
      setSearchPayLoading(false);
    }
  };

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const returnCountry = searchParams.get("country");
    const returnExpertise = searchParams.get("expertise");

    if (sessionId && !confirmingPayment && confirmedSessionRef.current !== sessionId) {
      confirmedSessionRef.current = sessionId;
      setConfirmingPayment(true);
      fetch("/api/lawyers/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          session_id: sessionId,
          country: returnCountry ?? undefined,
          expertise: returnExpertise ?? undefined,
        }),
      })
        .then((res) => res.json())
        .then(async (data) => {
          if (data.ok) {
            if (returnCountry) setSelectedCountry(returnCountry);
            if (returnExpertise) setSelectedExpertise(returnExpertise);
            setHasSearched(true);
            await refetchUnlocked();
            const keep = new URLSearchParams();
            if (returnCountry) keep.set("country", returnCountry);
            if (returnExpertise) keep.set("expertise", returnExpertise);
            const path = keep.toString() ? `/lawyers?${keep.toString()}` : "/lawyers";
            window.history.replaceState({}, "", path);
          }
        })
        .catch(() => {})
        .finally(() => setConfirmingPayment(false));
      return;
    }

    if (!sessionId && returnCountry != null && returnExpertise != null) {
      setSelectedCountry(returnCountry || "all");
      setSelectedExpertise(returnExpertise || "all");
      setHasSearched(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/lawyers")
      .then((res) => res.json())
      .then((data: { lawyers?: Lawyer[] }) => {
        setLawyers(Array.isArray(data.lawyers) ? data.lawyers : []);
      })
      .catch(() => setLawyers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetchUnlocked();
  }, []);

  const expertiseList = Array.from(
    new Set(lawyers.flatMap((l) => l.expertise.split(",").map((e) => e.trim()).filter(Boolean)))
  ).sort();

  const filteredLawyers = useMemo(() => {
    return lawyers.filter((lawyer) => {
      if (selectedCountry !== "all" && lawyer.country !== selectedCountry) return false;
      if (selectedCity.trim() && !lawyer.name.toLowerCase().includes(selectedCity.toLowerCase()) && !lawyer.expertise.toLowerCase().includes(selectedCity.toLowerCase())) return false;
      if (selectedExpertise !== "all" && !lawyer.expertise.toLowerCase().includes(selectedExpertise.toLowerCase())) return false;
      return true;
    });
  }, [lawyers, selectedCountry, selectedCity, selectedExpertise]);

  // Fetch reviews for displayed lawyers
  useEffect(() => {
    if (filteredLawyers.length === 0) return;
    Promise.all(
      filteredLawyers.map((lawyer) =>
        fetch(`/api/lawyers/${lawyer.id}/reviews`)
          .then((r) => r.json())
          .then((data: { averageRating?: number | null; totalReviews?: number }) => {
            if (data.averageRating !== null && data.averageRating !== undefined) {
              setReviewsByLawyer((prev) => ({
                ...prev,
                [lawyer.id]: {
                  averageRating: data.averageRating ?? 0,
                  totalReviews: data.totalReviews ?? 0,
                },
              }));
            }
          })
          .catch(() => {})
      )
    );
  }, [filteredLawyers]);

  const isUnlocked = (lawyerId: string) => dayPassActive || unlockedIds.has(lawyerId);

  const clearFilters = () => {
    setSelectedCountry("all");
    setSelectedCity("");
    setSelectedExpertise("all");
    setSelectedLanguage("all");
    setHasSearched(false);
  };

  const expertiseRequired = selectedExpertise === "all";
  const runSearch = () => {
    if (expertiseRequired) return;
    setHasSearched(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {confirmingPayment && (
        <div className="border-b border-border bg-primary/10 px-4 py-3">
          <div className="mx-auto flex max-w-7xl items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Confirming payment…
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-muted/25 via-background to-background">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-full opacity-[0.22] blur-[110px] dark:opacity-30"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-40 right-[-10%] h-80 w-80 rounded-full opacity-[0.16] blur-[90px] dark:opacity-25"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-20 sm:px-6 lg:px-8 sm:pt-14">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/90 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Verified African lawyers
            </p>
            <h1 className="heading mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.5rem]">
              Find counsel anywhere in Africa.
            </h1>
          </div>
        </div>
      </section>

      {/* Filters + results */}
      <section className="-mt-10 pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Search filters card */}
          <div className="mb-8 rounded-2xl border border-border/70 bg-card/95 p-5 shadow-lg shadow-primary/10 backdrop-blur-xl sm:p-6">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div className="max-w-xl">
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Choose <strong>country</strong> and <strong>practice area</strong> (required). One search costs ${SEARCH_PRICE} and
                  unlocks contact details for all matching lawyers.
                </p>
              </div>
              <div className="hidden text-xs text-muted-foreground md:block">
                <span className="rounded-full bg-muted px-3 py-1 font-medium text-foreground">
                  ${SEARCH_PRICE} per search
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                  Location (Country)
                </label>
                <select
                  className="w-full rounded-xl border border-input bg-background/90 px-3 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/40"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                >
                  <option value="all">All countries</option>
                  {AFRICAN_COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                  Search (name or expertise)
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="e.g. Lagos, corporate, arbitration…"
                    className="w-full rounded-xl border border-input bg-background/90 px-10 py-2.5 text-sm shadow-sm outline-none ring-0 transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/40"
                    value={selectedCity}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedCity(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                  Area of expertise <span className="text-destructive">*</span>
                </label>
                <select
                  className="w-full rounded-xl border border-input bg-background/90 px-3 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/40"
                  value={selectedExpertise}
                  onChange={(e) => setSelectedExpertise(e.target.value)}
                >
                  <option value="all">All practice areas</option>
                  {expertiseList.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                  {expertiseList.length === 0 &&
                    EXPERTISE_OPTIONS.slice(1).map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                  Language
                </label>
                <select
                  className="w-full rounded-xl border border-input bg-background/90 px-3 py-2.5 text-sm shadow-sm outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/40"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang} value={lang === "All Languages" ? "all" : lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {expertiseRequired && (
              <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
                Please select a practice area. Country + practice area are required so your ${SEARCH_PRICE} unlock
                applies to a specific search.
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={runSearch}
                disabled={expertiseRequired}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[rgba(154,99,42,0.95)] to-[rgba(193,140,67,0.95)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <Search className="h-4 w-4" />
                Search directory
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/80 px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/60 hover:bg-primary/5 hover:text-foreground sm:text-sm"
              >
                Clear filters
              </button>
            </div>
          </div>

          {/* Before search: prompt user to enter criteria */}
          {!hasSearched && (
            <div className="rounded-2xl border border-dashed border-border/80 bg-card/90 p-8 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">
                Select <strong>country</strong> and <strong>practice area</strong>, then click{" "}
                <strong>Search directory</strong> to see matching lawyers.
              </p>
            </div>
          )}

        {/* Pay $5 for this search — show when user has searched with a specific expertise, there are results, and at least one is locked */}
        {hasSearched && selectedExpertise !== "all" && filteredLawyers.length > 0 && (() => {
          const allUnlocked = filteredLawyers.every((l) => isUnlocked(l.id));
          if (allUnlocked) {
            return (
              <div className="mb-6 rounded-xl border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-200">
                You have full access to all {filteredLawyers.length} lawyer{filteredLawyers.length !== 1 ? "s" : ""} in this search.
              </div>
            );
          }
          return (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm">
              <div className="max-w-xl">
                <p className="text-sm font-semibold text-foreground">
                  {filteredLawyers.length} lawyer{filteredLawyers.length !== 1 ? "s" : ""} match your criteria.
                </p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Pay ${SEARCH_PRICE} to unlock contact details for all{" "}
                  {filteredLawyers.length} lawyer{filteredLawyers.length !== 1 ? "s" : ""} in this search (
                  {selectedCountry === "all" ? "All countries" : selectedCountry} + {selectedExpertise}).
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {searchPayError && <p className="text-xs text-red-600 sm:text-sm">{searchPayError}</p>}
                <button
                  type="button"
                  onClick={handlePayForSearch}
                  disabled={searchPayLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[rgba(154,99,42,0.95)] to-[rgba(193,140,67,0.95)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-105 disabled:opacity-60"
                >
                  {searchPayLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Pay ${SEARCH_PRICE} & unlock all
                </button>
              </div>
            </div>
          );
        })()}

        {hasSearched && (
          <div className="mb-4 text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {filteredLawyers.length} verified lawyer{filteredLawyers.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !hasSearched ? null : filteredLawyers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/90 p-12 text-center shadow-sm">
            <div className="mb-4 text-5xl">🔍</div>
            <h3 className="text-xl font-semibold text-foreground">
              {selectedCountry !== "all"
                ? "No lawyers from this country yet"
                : "No lawyers found"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedCountry !== "all"
                ? `We don't have any lawyers from ${selectedCountry} in our directory yet. Try another country or check back later.`
                : "Try adjusting your search filters to see more results."}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-6 inline-flex items-center justify-center rounded-xl border border-primary/70 bg-primary/10 px-6 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary hover:bg-primary/20"
            >
              Reset search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {filteredLawyers.map((lawyer) => {
              const unlocked = isUnlocked(lawyer.id);
              const contacts = contactsByLawyer[lawyer.id];
              const expertiseTags = lawyer.expertise.split(",").map((e) => e.trim()).filter(Boolean);
              const initials = lawyer.name.split(" ").map((n) => n[0]).filter(Boolean).join("");
              const initialsDisplay = lawyer.name.split(" ").map((n) => n[0]).filter(Boolean).join(". ") + ".";

              return (
                <div
                  key={lawyer.id}
                  className="group overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm shadow-border/40 transition hover:-translate-y-1 hover:border-primary/70 hover:shadow-lg hover:shadow-primary/20"
                >
                  <div className="h-1 w-full bg-gradient-to-r from-[rgba(193,140,67,0.9)] via-[rgba(227,186,101,0.95)] to-[rgba(154,99,42,0.9)] opacity-80" />
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-bold text-white shadow-sm shadow-primary/40"
                        style={{ background: `linear-gradient(to bottom right, ${BRAND.gradientEnd}, ${BRAND.gradientStart})` }}
                      >
                        {unlocked && lawyer.imageUrl ? (
                          <Image src={lawyer.imageUrl} alt="" width={80} height={80} className="h-full w-full object-cover" />
                        ) : !unlocked && lawyer.imageUrl ? (
                          <>
                            <Image src={lawyer.imageUrl} alt="" width={80} height={80} className="h-full w-full object-cover blur-md scale-110" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                              <Lock className="w-6 h-6 text-white/90" />
                            </div>
                          </>
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          {unlocked ? (
                            <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">
                              {lawyer.name}
                            </h3>
                          ) : (
                            <h3 className="truncate text-sm font-semibold text-muted-foreground sm:text-base">
                              {initialsDisplay}
                            </h3>
                          )}
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                            Verified
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground sm:text-sm">
                          {unlocked ? lawyer.expertise : "Practice area · details hidden until unlock"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          📍 {lawyer.country}
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <Star className="h-4 w-4 fill-current text-yellow-500" />
                          {reviewsByLawyer[lawyer.id]?.totalReviews > 0 ? (
                            <>
                              <span className="text-sm font-semibold text-foreground">
                                {reviewsByLawyer[lawyer.id].averageRating.toFixed(1)}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                ({reviewsByLawyer[lawyer.id].totalReviews} review{reviewsByLawyer[lawyer.id].totalReviews !== 1 ? "s" : ""})
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-bold text-foreground">—</span>
                              <span className="text-sm text-muted-foreground">(No ratings yet)</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {expertiseTags.map((exp, i) => (
                        <span
                          key={i}
                          className="rounded-full px-3 py-1 text-[11px] font-medium"
                          style={{ backgroundColor: "rgba(227, 186, 101, 0.2)", color: BRAND.medium }}
                        >
                          {exp}
                        </span>
                      ))}
                    </div>

                    <div
                      className="mb-4 rounded-xl border-2 border-dashed bg-muted/30 p-4"
                      style={{ borderColor: unlocked ? "#10b981" : BRAND.gradientEnd }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{unlocked ? "🔓" : "🔒"}</span>
                        <div className="flex-1">
                          {unlocked ? (
                            <div>
                              <div className="text-sm font-semibold text-green-700 dark:text-green-400">
                                Contact information unlocked
                              </div>
                              <div className="text-xs text-muted-foreground">
                                You have full access to contact details.
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-sm font-semibold" style={{ color: BRAND.medium }}>
                                Contact information locked
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Pay ${SEARCH_PRICE} for this search above to view contact details.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        {unlocked && contacts ? (
                          <>
                            {contacts.email && (
                              <div className="flex items-center gap-2 text-foreground">
                                <span>📧</span>
                                <a href={`mailto:${contacts.email}`} className="font-medium underline hover:opacity-80">{contacts.email}</a>
                              </div>
                            )}
                            {contacts.phone && (
                              <div className="flex items-center gap-2 text-foreground">
                                <span>📱</span>
                                <a href={`tel:${contacts.phone}`} className="font-medium underline hover:opacity-80">{contacts.phone}</a>
                              </div>
                            )}
                            {contacts.contacts && (
                              <div className="flex items-center gap-2 text-foreground">
                                <span>💼</span>
                                <span className="font-medium whitespace-pre-wrap">{contacts.contacts}</span>
                              </div>
                            )}
                            {!contacts.email && !contacts.phone && !contacts.contacts && (
                              <div className="text-muted-foreground">No contact details on file</div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span>📧</span>
                              <span>Email: ••••••@•••••.com</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span>📱</span>
                              <span>Phone: +••• ••• ••• ••••</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span>💼</span>
                              <span>Office Address: •••••••••••••</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {unlocked ? (
                      <div className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-green-300 bg-green-50 px-6 py-3 text-sm font-semibold text-green-700 dark:border-green-500/50 dark:bg-green-500/10 dark:text-green-400">
                        <span className="text-lg">✓</span>
                        Full Access Granted
                      </div>
                    ) : (
                      <p className="py-2 text-center text-xs text-muted-foreground sm:text-sm">
                        Unlock all results for this search with a single ${SEARCH_PRICE} payment above.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {lawyers.length > 0 && (
          <p className="mt-8 text-center text-xs text-muted-foreground sm:text-sm">
            <strong>${SEARCH_PRICE} per search</strong> (country + practice area). Your payment unlocks contact details
            for the lawyers in that search. Different country or practice area = a new search. Payments are processed
            securely via mobile money.
          </p>
        )}
        </div>
      </section>
    </div>
  );
}
