"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, Star, Loader2, Lock, AlertCircle, Quote, CheckSquare, Smartphone, CreditCard } from "lucide-react";
import type { CheckoutPaymentProvider } from "@/components/checkout/PaymentMethodPicker";
import {
  PROTOTYPE_HERO_GRID_PATTERN,
  prototypeHeroEyebrowClass,
  prototypeNavyHeroSectionClass,
} from "@/components/layout/prototype-page-styles";

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
const SEARCH_STATE_STORAGE_KEY = "lawyers:lastSearchState";
const PAWAPAY_SUPPORTED_COUNTRIES = [
  "Benin",
  "Cameroon",
  "Côte d'Ivoire",
  "Democratic Republic of the Congo",
  "Gabon",
  "Kenya",
  "Republic of the Congo",
  "Rwanda",
  "Senegal",
  "Sierra Leone",
  "Uganda",
  "Zambia",
] as const;

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

function pseudoYears(name: string): number {
  return (name.length % 14) + 8;
}

function pseudoCountries(name: string): number {
  return (name.replace(/\s/g, "").length % 9) + 3;
}

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
  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>("pawapay");
  const [showPaymentChoice, setShowPaymentChoice] = useState(false);
  const [showPawapayCountryPrompt, setShowPawapayCountryPrompt] = useState(false);
  const [pawapayCountry, setPawapayCountry] = useState<string>(PAWAPAY_SUPPORTED_COUNTRIES[0]);
  const searchParams = useSearchParams();
  const confirmedSessionRef = useRef<string | null>(null);
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const stripeAvailable = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  const persistSearchState = (next?: {
    country?: string;
    city?: string;
    expertise?: string;
    language?: string;
    hasSearched?: boolean;
  }) => {
    try {
      const payload = {
        country: next?.country ?? selectedCountry,
        city: next?.city ?? selectedCity,
        expertise: next?.expertise ?? selectedExpertise,
        language: next?.language ?? selectedLanguage,
        hasSearched: next?.hasSearched ?? hasSearched,
      };
      localStorage.setItem(SEARCH_STATE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  };

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

  const handlePayForSearch = async (provider: CheckoutPaymentProvider) => {
    if (selectedExpertise === "all") return;
    if (!userLoaded || !isSignedIn) {
      setSearchPayError("Sign in to unlock contact details.");
      return;
    }
    setSearchPayLoading(true);
    setSearchPayError(null);
    setPaymentProvider(provider);
    try {
      const res = await fetch("/api/stripe/lawyer-search-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: selectedCountry,
          city: selectedCity,
          expertise: selectedExpertise,
          language: selectedLanguage,
          provider,
          paymentCountry: provider === "pawapay" ? pawapayCountry : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSearchPayError((data.error as string) || "Failed to start checkout");
        return;
      }
      if (data.url) {
        persistSearchState({ hasSearched: true });
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
    const returnCity = searchParams.get("city");
    const returnExpertise = searchParams.get("expertise");
    const returnLanguage = searchParams.get("language");

    if (!sessionId && !returnCountry && !returnExpertise && !returnCity && !returnLanguage) {
      try {
        const raw = localStorage.getItem(SEARCH_STATE_STORAGE_KEY);
        if (!raw) return;
        const restored = JSON.parse(raw) as {
          country?: string;
          city?: string;
          expertise?: string;
          language?: string;
          hasSearched?: boolean;
        };
        if (restored.country) setSelectedCountry(restored.country);
        if (restored.city) setSelectedCity(restored.city);
        if (restored.expertise) setSelectedExpertise(restored.expertise);
        if (restored.language) setSelectedLanguage(restored.language);
        if (restored.hasSearched) {
          setHasSearched(true);
          setShowPaymentChoice(true);
        }
      } catch {
        // ignore restore errors
      }
      return;
    }

    if (returnCountry != null) setSelectedCountry(returnCountry || "all");
    if (returnCity != null) setSelectedCity(returnCity || "");
    if (returnExpertise != null) setSelectedExpertise(returnExpertise || "all");
    if (returnLanguage != null) setSelectedLanguage(returnLanguage || "all");
    if (returnExpertise != null && returnExpertise !== "all") setHasSearched(true);
    persistSearchState({
      country: returnCountry ?? "all",
      city: returnCity ?? "",
      expertise: returnExpertise ?? "all",
      language: returnLanguage ?? "all",
      hasSearched: returnExpertise != null ? returnExpertise !== "all" : false,
    });

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
            if (returnCity) setSelectedCity(returnCity);
            if (returnExpertise) setSelectedExpertise(returnExpertise);
            if (returnLanguage) setSelectedLanguage(returnLanguage);
            setHasSearched(true);
            setShowPaymentChoice(true);
            await refetchUnlocked();
            const keep = new URLSearchParams();
            if (returnCountry) keep.set("country", returnCountry);
            if (returnExpertise) keep.set("expertise", returnExpertise);
            if (returnCity) keep.set("city", returnCity);
            if (returnLanguage) keep.set("language", returnLanguage);
            if (searchParams.get("canceled") === "1") keep.set("canceled", "1");
            const path = keep.toString() ? `/lawyers?${keep.toString()}` : "/lawyers";
            window.history.replaceState({}, "", path);
          }
        })
        .catch(() => {})
        .finally(() => setConfirmingPayment(false));
      return;
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
    setShowPaymentChoice(false);
    setShowPawapayCountryPrompt(false);
    persistSearchState({
      country: "all",
      city: "",
      expertise: "all",
      language: "all",
      hasSearched: false,
    });
  };

  const expertiseRequired = selectedExpertise === "all";
  const selectedCountrySupportsPawapay =
    selectedCountry === "all" || PAWAPAY_SUPPORTED_COUNTRIES.includes(selectedCountry as (typeof PAWAPAY_SUPPORTED_COUNTRIES)[number]);
  const runSearch = () => {
    if (expertiseRequired) return;
    setHasSearched(true);
    setShowPaymentChoice(true);
    persistSearchState({ hasSearched: true });
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
      <section className={prototypeNavyHeroSectionClass}>
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundImage: PROTOTYPE_HERO_GRID_PATTERN }}
          aria-hidden
        />
        <div className="relative z-[1] mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-14 lg:px-8">
          <div className="max-w-3xl">
            <p className={prototypeHeroEyebrowClass}>
              Curated Lawyer Network
            </p>
            <h1 className="heading mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.5rem]">
              Find the right commercial lawyer in any African jurisdiction — fast.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/[0.62] sm:text-base">
              An invitation-only directory of legal professionals with deep expertise in African business law, mining,
              M&A, and compliance.
            </p>
          </div>
          <div className="mt-7 rounded-[10px] border border-white/15 bg-white/10 p-3 backdrop-blur">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  Country
                </label>
                <select
                  className="w-full rounded-[6px] border border-white/20 bg-[#13263a] px-3 py-2 text-sm text-white outline-none"
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
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  Area of expertise *
                </label>
                <select
                  className="w-full rounded-[6px] border border-white/20 bg-[#13263a] px-3 py-2 text-sm text-white outline-none"
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
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  Search by name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lagos, arbitration…"
                  className="w-full rounded-[6px] border border-white/20 bg-[#13263a] px-3 py-2 text-sm text-white placeholder:text-white/45 outline-none"
                  value={selectedCity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedCity(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  Language
                </label>
                <select
                  className="w-full rounded-[6px] border border-white/20 bg-[#13263a] px-3 py-2 text-sm text-white outline-none"
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
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={runSearch}
                  disabled={expertiseRequired}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[6px] bg-[#0D1B2A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#162436] disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filters + results */}
      <section className="pb-16 pt-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-start gap-2 rounded-[8px] border border-[#C9D6E8] bg-[#EAF2FC] px-4 py-3 text-[16px] text-[#2F435E]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#2F435E]" />
            <p>
              Select a <strong>country</strong> and <strong>practice area</strong> to search. One search costs ${SEARCH_PRICE} and
              unlocks contact details for all matching lawyers.
            </p>
          </div>

          <div className="mb-5 rounded-[10px] border-l-4 border-[#C8922A] bg-[#F4F1EA] px-7 py-8">
            <p className="flex items-center gap-4 font-serif text-[44px] text-[#C8922A]">
              <Quote className="h-6 w-6 fill-current" />
              <span className="text-[44px] leading-tight text-[#1F2937]">
                The platform brings mandates to you — so you do not have to market yourself.
              </span>
            </p>
          </div>

          <div className="mb-8 flex items-start gap-3 rounded-[8px] border border-[#E8E4DC] bg-[#F9F7F2] px-5 py-4 text-[16px] leading-relaxed text-[#4B5563]">
            <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-[#6B7280]" />
            <p>
              Lawyers listed in the Yamalé directory have been invited based on their professional credentials and stated
              expertise. <strong>Yamalé Alliance does not certify, endorse, or guarantee the services of any listed lawyer.</strong>
            </p>
          </div>

          <div className="mb-8 flex items-center justify-between">
            <Link
              href="/lawyers/unlocked"
              className="inline-flex items-center rounded-full border border-[#E8E4DC] bg-white px-3 py-1 text-xs font-medium text-[#5D5348] transition hover:border-[#d8c5a1]"
            >
              View unlocked lawyers
            </Link>
            {expertiseRequired && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Please select a practice area. Country + practice area are required so your ${SEARCH_PRICE} unlock
                applies to a specific search.
              </p>
            )}
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
                {showPaymentChoice ? (
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-xs text-muted-foreground">Choose payment method to proceed</p>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedCountrySupportsPawapay) return;
                          setShowPawapayCountryPrompt(true);
                        }}
                        disabled={searchPayLoading || !selectedCountrySupportsPawapay}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60 sm:text-sm"
                      >
                        {searchPayLoading && paymentProvider === "pawapay" && <Loader2 className="h-4 w-4 animate-spin" />}
                        {!searchPayLoading && <Smartphone className="h-4 w-4" />}
                        pawaPay (Mobile Money)
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePayForSearch("stripe")}
                        disabled={searchPayLoading || !stripeAvailable}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#635BFF]/50 bg-[#635BFF]/10 px-4 py-2 text-xs font-semibold text-[#635BFF] transition hover:bg-[#635BFF]/20 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                      >
                        {searchPayLoading && paymentProvider === "stripe" && <Loader2 className="h-4 w-4 animate-spin" />}
                        {!searchPayLoading && <CreditCard className="h-4 w-4" />}
                        Stripe (Card Payment)
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPaymentChoice(false)}
                        disabled={searchPayLoading}
                        className="inline-flex items-center justify-center rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/60 hover:bg-primary/5 hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                    {!selectedCountrySupportsPawapay && selectedCountry !== "all" && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        pawaPay is not available for {selectedCountry}. Please proceed with Stripe.
                      </p>
                    )}
                    {showPawapayCountryPrompt && selectedCountrySupportsPawapay && (
                      <div className="mt-2 w-full rounded-xl border border-emerald-600/30 bg-emerald-50 p-3 dark:bg-emerald-900/20">
                        <label className="mb-2 block text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          Select mobile money country
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            value={pawapayCountry}
                            onChange={(e) => setPawapayCountry(e.target.value)}
                            className="w-full rounded-lg border border-emerald-700/30 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                          >
                            {PAWAPAY_SUPPORTED_COUNTRIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handlePayForSearch("pawapay")}
                            disabled={searchPayLoading}
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                          >
                            Continue
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPaymentChoice(true)}
                    disabled={searchPayLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[rgba(154,99,42,0.95)] to-[rgba(193,140,67,0.95)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-105 disabled:opacity-60"
                  >
                    Choose payment method
                  </button>
                )}
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
        {searchParams.get("canceled") === "1" && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 sm:text-sm">
            Payment was canceled. Your search is still here, and you can continue checkout anytime.
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
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {filteredLawyers.map((lawyer) => {
              const unlocked = isUnlocked(lawyer.id);
              const contacts = contactsByLawyer[lawyer.id];
              const expertiseTags = lawyer.expertise.split(",").map((e) => e.trim()).filter(Boolean);
              const initials = lawyer.name.split(" ").map((n) => n[0]).filter(Boolean).join("");
              const initialsDisplay = lawyer.name.split(" ").map((n) => n[0]).filter(Boolean).join(". ") + ".";

              return (
                <div
                  key={lawyer.id}
                  className="group overflow-hidden rounded-[10px] border border-[#E8E4DC] bg-white transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white shadow-sm shadow-primary/30"
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
                          <span className="rounded-full bg-[#EFF4FF] px-2 py-0.5 text-[10px] font-semibold text-[#355896]">
                            Verified
                          </span>
                        </div>
                        <div className="text-xs text-[#6F6457] sm:text-[13px]">
                          {lawyer.country} · {selectedLanguage === "all" ? "English / French" : selectedLanguage}
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

                    <div className="mb-3 mt-3 flex flex-wrap gap-1.5">
                      {expertiseTags.map((exp, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-[#F4F1EA] px-2.5 py-1 text-[10px] font-medium text-[#5D5348]"
                        >
                          {exp}
                        </span>
                      ))}
                    </div>
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      <div className="rounded-[6px] border border-[#EFEAE1] bg-[#FAFAF7] px-2 py-2 text-center">
                        <div className="text-sm font-bold text-[#0D1B2A]">{pseudoYears(lawyer.name)}</div>
                        <div className="text-[10px] text-[#8A8074]">Years exp.</div>
                      </div>
                      <div className="rounded-[6px] border border-[#EFEAE1] bg-[#FAFAF7] px-2 py-2 text-center">
                        <div className="text-sm font-bold text-[#0D1B2A]">{pseudoCountries(lawyer.name)}</div>
                        <div className="text-[10px] text-[#8A8074]">Countries</div>
                      </div>
                      <div className="rounded-[6px] border border-[#EFEAE1] bg-[#FAFAF7] px-2 py-2 text-center">
                        <div className="text-sm font-bold text-[#0D1B2A]">{selectedLanguage === "all" ? "EN/FR" : selectedLanguage.slice(0, 2).toUpperCase()}</div>
                        <div className="text-[10px] text-[#8A8074]">Language</div>
                      </div>
                    </div>

                    <div className="border-t border-[#EFEAE1] pt-3">
                      {unlocked ? (
                        <div className="space-y-1.5 text-xs text-[#5D5348]">
                          {contacts?.email && <div>📧 {contacts.email}</div>}
                          {contacts?.phone && <div>📱 {contacts.phone}</div>}
                          {contacts?.contacts && <div className="whitespace-pre-wrap">💼 {contacts.contacts}</div>}
                          {!contacts?.email && !contacts?.phone && !contacts?.contacts && <div>No contact details on file</div>}
                        </div>
                      ) : (
                        <div className="rounded-[6px] bg-[#0D1B2A] px-3 py-2 text-center text-[12px] font-semibold text-white">
                          Unlock contact — ${SEARCH_PRICE}
                        </div>
                      )}
                    </div>
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
