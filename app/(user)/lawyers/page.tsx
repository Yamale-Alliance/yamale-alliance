"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
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
    if (filteredLawyers.length === 0 || selectedExpertise === "all") return;
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
          lawyerIds: filteredLawyers.map((l) => l.id),
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

  const filteredLawyers = lawyers.filter((lawyer) => {
    if (selectedCountry !== "all" && lawyer.country !== selectedCountry) return false;
    if (selectedCity.trim() && !lawyer.name.toLowerCase().includes(selectedCity.toLowerCase()) && !lawyer.expertise.toLowerCase().includes(selectedCity.toLowerCase())) return false;
    if (selectedExpertise !== "all" && !lawyer.expertise.toLowerCase().includes(selectedExpertise.toLowerCase())) return false;
    return true;
  });

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
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {confirmingPayment && (
        <div className="border-b border-border bg-primary/10 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Confirming payment…
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: BRAND.dark }}>
            Legal Professional Directory
          </h1>
          <p className="text-muted-foreground">Find verified lawyers across Africa</p>
        </div>

        {/* Search: what type of lawyer are you looking for? */}
        <div className="bg-white dark:bg-card rounded-lg shadow-md border border-border p-6 mb-6">
          <h2 className="text-2xl font-bold mb-2" style={{ color: BRAND.dark }}>
            What type of lawyer are you looking for?
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Choose <strong>country</strong> and <strong>practice area</strong> (required), then search. One search costs ${SEARCH_PRICE} and unlocks that combination forever — including any lawyers added later.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND.medium }}>
                Location (Country)
              </label>
              <select
                className="w-full border border-input rounded-lg px-4 py-2 bg-background focus:outline-none focus:ring-2"
                style={{ focusRingColor: BRAND.gradientEnd } as React.CSSProperties}
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
              >
                <option value="all">All Countries</option>
                {AFRICAN_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND.medium }}>
                Search (name or expertise)
              </label>
              <input
                type="text"
                placeholder="e.g. Lagos, Corporate..."
                className="w-full border border-input rounded-lg px-4 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0"
                value={selectedCity}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedCity(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND.medium }}>
                Area of Expertise <span className="text-destructive">*</span>
              </label>
              <select
                className="w-full border border-input rounded-lg px-4 py-2 bg-background focus:outline-none focus:ring-2"
                value={selectedExpertise}
                onChange={(e) => setSelectedExpertise(e.target.value)}
              >
                <option value="all">All Practice Areas</option>
                {expertiseList.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
                {expertiseList.length === 0 && EXPERTISE_OPTIONS.slice(1).map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: BRAND.medium }}>
                Language
              </label>
              <select
                className="w-full border border-input rounded-lg px-4 py-2 bg-background focus:outline-none focus:ring-2"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang} value={lang === "All Languages" ? "all" : lang}>{lang}</option>
                ))}
              </select>
            </div>
          </div>
          {expertiseRequired && (
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
              Please select a practice area to search. Country + practice area are required so your $5 unlock applies to a specific search.
            </p>
          )}
          <button
            type="button"
            onClick={runSearch}
            disabled={expertiseRequired}
            className="w-full text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: `linear-gradient(to right, ${BRAND.gradientStart}, ${BRAND.gradientEnd})` }}
          >
            <Search className="w-5 h-5" />
            Search
          </button>
        </div>

        {/* Before search: prompt user to enter criteria */}
        {!hasSearched && (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              Select <strong>country</strong> and <strong>practice area</strong> (required), then click <strong>Search</strong> to find lawyers.
            </p>
          </div>
        )}

        {/* Pay $5 for this search — show when user has searched with a specific expertise, there are results, and at least one is locked */}
        {hasSearched && selectedExpertise !== "all" && filteredLawyers.length > 0 && (() => {
          const allUnlocked = filteredLawyers.every((l) => isUnlocked(l.id));
          if (allUnlocked) {
            return (
              <div className="mb-6 rounded-lg border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-200">
                You have full access to all {filteredLawyers.length} lawyer{filteredLawyers.length !== 1 ? "s" : ""} in this search.
              </div>
            );
          }
          return (
            <div className="mb-6 bg-white dark:bg-card rounded-lg shadow border border-border p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground">
                  {filteredLawyers.length} lawyer{filteredLawyers.length !== 1 ? "s" : ""} match your criteria.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Pay ${SEARCH_PRICE} once to unlock this search forever ({selectedCountry === "all" ? "All countries" : selectedCountry} + {selectedExpertise}). You&apos;ll keep access even when we add more lawyers matching this criteria.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {searchPayError && <p className="text-sm text-red-600">{searchPayError}</p>}
                <button
                  type="button"
                  onClick={handlePayForSearch}
                  disabled={searchPayLoading}
                  className="text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-60"
                  style={{ background: `linear-gradient(to right, ${BRAND.gradientStart}, ${BRAND.gradientEnd})` }}
                >
                  {searchPayLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                  Pay ${SEARCH_PRICE} & see all {filteredLawyers.length} results
                </button>
              </div>
            </div>
          );
        })()}

        {hasSearched && (
          <div className="mb-4 text-muted-foreground">
            Showing {filteredLawyers.length} verified lawyer{filteredLawyers.length !== 1 ? "s" : ""}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !hasSearched ? null : filteredLawyers.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-lg shadow border border-border p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold mb-2" style={{ color: BRAND.medium }}>
              {selectedCountry !== "all"
                ? "No lawyers from this country yet"
                : "No lawyers found"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {selectedCountry !== "all"
                ? `We don't have any lawyers from ${selectedCountry} in our directory yet. Try another country or check back later.`
                : "Try adjusting your search filters to see more results."}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="px-6 py-2 rounded-lg font-semibold border-2"
              style={{ borderColor: BRAND.gradientEnd, color: BRAND.medium }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredLawyers.map((lawyer) => {
              const unlocked = isUnlocked(lawyer.id);
              const contacts = contactsByLawyer[lawyer.id];
              const expertiseTags = lawyer.expertise.split(",").map((e) => e.trim()).filter(Boolean);
              const initials = lawyer.name.split(" ").map((n) => n[0]).filter(Boolean).join("");
              const initialsDisplay = lawyer.name.split(" ").map((n) => n[0]).filter(Boolean).join(". ") + ".";

              return (
                <div
                  key={lawyer.id}
                  className="bg-white dark:bg-card rounded-lg shadow border border-border hover:shadow-lg transition overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 overflow-hidden relative"
                        style={{ background: `linear-gradient(to bottom right, ${BRAND.gradientEnd}, ${BRAND.gradientStart})` }}
                      >
                        {unlocked && lawyer.imageUrl ? (
                          <img src={lawyer.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : !unlocked && lawyer.imageUrl ? (
                          <>
                            <img src={lawyer.imageUrl} alt="" className="h-full w-full object-cover blur-md scale-110" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                              <Lock className="w-6 h-6 text-white/90" />
                            </div>
                          </>
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {unlocked ? (
                            <h3 className="text-xl font-bold text-foreground">{lawyer.name}</h3>
                          ) : (
                            <h3 className="text-xl font-bold text-muted-foreground">{initialsDisplay}</h3>
                          )}
                          <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs px-2 py-0.5 rounded-full font-semibold">
                            Verified
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          {unlocked ? lawyer.expertise : "Practice area • Details hidden until unlock"}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          📍 {lawyer.country}
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <Star className="w-5 h-5 text-yellow-500 fill-current" />
                          <span className="font-bold text-foreground">—</span>
                          <span className="text-sm text-muted-foreground">(No ratings yet)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {expertiseTags.map((exp, i) => (
                        <span
                          key={i}
                          className="text-xs px-3 py-1 rounded-full font-medium"
                          style={{ backgroundColor: "rgba(227, 186, 101, 0.2)", color: BRAND.medium }}
                        >
                          {exp}
                        </span>
                      ))}
                    </div>

                    <div className="bg-muted/30 border-2 border-dashed rounded-lg p-4 mb-4" style={{ borderColor: unlocked ? "#10b981" : BRAND.gradientEnd }}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{unlocked ? "🔓" : "🔒"}</span>
                        <div className="flex-1">
                          {unlocked ? (
                            <>
                              <div className="font-semibold text-green-700 dark:text-green-400">Contact Information Unlocked</div>
                              <div className="text-sm text-muted-foreground">You have full access to contact details</div>
                            </>
                          ) : (
                            <>
                              <div className="font-semibold" style={{ color: BRAND.medium }}>Contact Information Locked</div>
                              <div className="text-sm text-muted-foreground">Pay $5 for this search above to view all contact details</div>
                            </>
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
                      <div className="w-full px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 bg-green-50 dark:bg-green-500/10 border-2 border-green-300 dark:border-green-500/50 text-green-700 dark:text-green-400">
                        <span className="text-lg">✓</span>
                        Full Access Granted
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Unlock all results for this search with one $5 payment above.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {lawyers.length > 0 && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <strong>$5 per search</strong> (country + practice area). You keep access to that search forever, including new lawyers we add. Different country or practice area = new $5 search. Secure payment via Stripe.
          </p>
        )}
      </div>
    </div>
  );
}
