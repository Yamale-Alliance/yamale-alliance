"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, Star, Loader2, Lock, AlertCircle, Quote, CheckSquare, Smartphone, CreditCard } from "lucide-react";
import {
  defaultCheckoutPaymentProvider,
  type CheckoutPaymentProvider,
} from "@/components/checkout/PaymentMethodPicker";
import { usePlatformSettings } from "@/components/platform/PlatformSettingsContext";
import { MarketingDiscountPrice } from "@/components/pricing/MarketingDiscountPrice";
import { confirmDayPassPayment } from "@/lib/day-pass-checkout-confirm";
import {
  PROTOTYPE_HERO_GRID_PATTERN,
  prototypeHeroEyebrowClass,
} from "@/components/layout/prototype-page-styles";
import { PAWAPAY_SUPPORTED_PAYMENT_COUNTRIES as PAWAPAY_SUPPORTED_COUNTRIES } from "@/lib/pawapay-payment-countries";
import {
  buildExpertiseFilterOptions,
  dedupeExpertiseSegments,
  expertiseMatchesAnySelection,
  formatExpertiseSelection,
  parseExpertiseSelectionInput,
  parseExpertiseSegments,
} from "@/lib/lawyer-expertise";
import { LawyersOnboardingVideo } from "@/components/lawyers/LawyersOnboardingVideo";
import { LawyerPracticeAreaMultiSelect } from "@/components/lawyers/LawyerPracticeAreaMultiSelect";
import { lawyerUnlockedForViewer } from "@/lib/lawyers-admin-presentation";
import { useLawyerPracticeAreaLabel } from "@/lib/i18n/use-catalog-labels";
import {
  collectLawyerLanguages,
  formatLawyerLanguagesAbbrev,
  lawyerSpeaksLanguage,
  lawyerLanguageKey,
} from "@/lib/lawyer-languages";

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
  city: string;
  expertise: string;
  linkedinUrl: string | null;
  imageUrl: string | null;
  primaryLanguage: string | null;
  otherLanguages: string | null;
};

const SEARCH_STATE_STORAGE_KEY = "lawyers:lastSearchState";

const LANGUAGE_OPTION_VALUES = [
  { value: "all", messageKey: "allLanguages" },
  { value: "English", messageKey: "languageOptions.english" },
  { value: "French", messageKey: "languageOptions.french" },
  { value: "Arabic", messageKey: "languageOptions.arabic" },
  { value: "Portuguese", messageKey: "languageOptions.portuguese" },
  { value: "Swahili", messageKey: "languageOptions.swahili" },
  { value: "Kinyarwanda", messageKey: "languageOptions.kinyarwanda" },
  { value: "Yoruba", messageKey: "languageOptions.yoruba" },
  { value: "Wolof", messageKey: "languageOptions.wolof" },
  { value: "Twi", messageKey: "languageOptions.twi" },
] as const;

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

export function LawyersPageClient({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("lawyers");
  const tCommon = useTranslations("common");
  const practiceAreaLabel = useLawyerPracticeAreaLabel();
  const lawyerLanguageLabel = (canonical: string) => {
    const option = LANGUAGE_OPTION_VALUES.find((item) => item.value === canonical);
    if (option && option.value !== "all") {
      return t(option.messageKey);
    }
    const byKey = LANGUAGE_OPTION_VALUES.find(
      (item) => item.value !== "all" && lawyerLanguageKey(item.value) === lawyerLanguageKey(canonical)
    );
    return byKey ? t(byKey.messageKey) : canonical;
  };
  const formatLocalizedLawyerLanguages = (languages: string[]) =>
    languages.map(lawyerLanguageLabel).join(" · ");
  const { isLoaded: userLoaded, isSignedIn } = useAppUser();
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [contactsByLawyer, setContactsByLawyer] = useState<Record<string, { email: string | null; phone: string | null; contacts: string | null }>>({});
  const [reviewsByLawyer, setReviewsByLawyer] = useState<Record<string, { averageRating: number; totalReviews: number }>>({});
  const [dayPassActive, setDayPassActive] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [hasSearched, setHasSearched] = useState(false);
  const [searchPayLoading, setSearchPayLoading] = useState(false);
  const [searchPayError, setSearchPayError] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [dayPassConfirmError, setDayPassConfirmError] = useState<string | null>(null);
  const [dayPassConfirmSuccess, setDayPassConfirmSuccess] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<CheckoutPaymentProvider>(
    defaultCheckoutPaymentProvider()
  );
  const [showPaymentChoice, setShowPaymentChoice] = useState(false);
  const [showPawapayCountryPrompt, setShowPawapayCountryPrompt] = useState(false);
  const [pawapayCountry, setPawapayCountry] = useState<string>(PAWAPAY_SUPPORTED_COUNTRIES[0]);
  const searchParams = useSearchParams();

  const confirmedSessionRef = useRef<string | null>(null);
  const lomiAvailable =
    process.env.NEXT_PUBLIC_LOMI_CHECKOUT_ENABLED === "1" ||
    Boolean(process.env.NEXT_PUBLIC_LOMI_PUBLISHABLE_KEY?.trim());
  const { lawyerSearchUnlockPriceUsdCents } = usePlatformSettings();
  const searchPrice = (
    <MarketingDiscountPrice currentCents={lawyerSearchUnlockPriceUsdCents} size="inline" />
  );
  const richTags = {
    strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
    price: () => searchPrice,
  };

  const persistSearchState = (next?: {
    country?: string;
    city?: string;
    expertise?: string[] | string;
    language?: string;
    hasSearched?: boolean;
  }) => {
    try {
      const expertiseValue = next?.expertise ?? selectedExpertise;
      const payload = {
        country: next?.country ?? selectedCountry,
        city: next?.city ?? selectedCity,
        expertise: Array.isArray(expertiseValue)
          ? expertiseValue
          : parseExpertiseSelectionInput(expertiseValue),
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
    if (selectedExpertise.length === 0 || selectedCountry === "") {
      setSearchPayError(t("selectCountryAndArea"));
      return;
    }
    if (!userLoaded || !isSignedIn) {
      setSearchPayError(t("signInToUnlock"));
      return;
    }
    setSearchPayLoading(true);
    setSearchPayError(null);
    setPaymentProvider(provider);
    try {
      const res = await fetch("/api/payments/lawyer-search-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: selectedCountry,
          city: selectedCity,
          expertise: formatExpertiseSelection(selectedExpertise),
          language: selectedLanguage,
          provider,
          paymentCountry: provider === "pawapay" ? pawapayCountry : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSearchPayError((data.error as string) || t("checkoutFailed"));
        return;
      }
      if (data.url) {
        persistSearchState({ hasSearched: true });
        window.location.href = data.url;
        return;
      }
      setSearchPayError(t("checkoutNotStarted"));
    } catch {
      setSearchPayError(tCommon("somethingWentWrong"));
    } finally {
      setSearchPayLoading(false);
    }
  };

  const clearStoredSearchState = () => {
    try {
      localStorage.removeItem(SEARCH_STATE_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const restoreStoredSearchState = () => {
    try {
      const raw = localStorage.getItem(SEARCH_STATE_STORAGE_KEY);
      if (!raw) return;
      const restored = JSON.parse(raw) as {
        country?: string;
        city?: string;
        expertise?: string[] | string;
        language?: string;
        hasSearched?: boolean;
      };
      if (restored.country) setSelectedCountry(restored.country);
      if (restored.city) setSelectedCity(restored.city);
      if (restored.expertise) setSelectedExpertise(parseExpertiseSelectionInput(restored.expertise));
      if (restored.language) setSelectedLanguage(restored.language);
      if (restored.hasSearched) {
        setHasSearched(true);
        setShowPaymentChoice(true);
      }
    } catch {
      // ignore restore errors
    }
  };

  const applyReturnFilters = (
    returnCountry: string | null,
    returnCity: string | null,
    returnExpertise: string | null,
    returnLanguage: string | null
  ) => {
    if (returnCountry != null) setSelectedCountry(returnCountry || "");
    if (returnCity != null) setSelectedCity(returnCity || "");
    if (returnExpertise != null) {
      setSelectedExpertise(parseExpertiseSelectionInput(returnExpertise));
    }
    if (returnLanguage != null) setSelectedLanguage(returnLanguage || "all");
    if (returnExpertise != null && parseExpertiseSelectionInput(returnExpertise).length > 0) {
      setHasSearched(true);
    }
  };

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const paymentCanceled = searchParams.get("canceled") === "1";
    const returnCountry = searchParams.get("country");
    const returnCity = searchParams.get("city");
    const returnExpertise = searchParams.get("expertise");
    const returnLanguage = searchParams.get("language");
    const fromAiResearch = searchParams.get("from") === "ai-research";
    const hasStaleFilterParams =
      !sessionId &&
      !fromAiResearch &&
      (returnCountry != null || returnExpertise != null || returnCity != null || returnLanguage != null);

    // Default landing: fresh search. Drop bookmarked ?country=&expertise= from a past purchase.
    if (hasStaleFilterParams) {
      window.history.replaceState({}, "", "/lawyers");
      return;
    }

    if (fromAiResearch && (returnCountry != null || returnExpertise != null)) {
      applyReturnFilters(returnCountry, returnCity, returnExpertise, returnLanguage);
      if (returnExpertise != null && parseExpertiseSelectionInput(returnExpertise).length > 0) {
        setHasSearched(true);
        setShowPaymentChoice(true);
      }
      return;
    }

    // Checkout canceled — restore the in-progress search so they can pay again.
    if (paymentCanceled || sessionId === "canceled") {
      if (returnCountry != null || returnExpertise != null) {
        applyReturnFilters(returnCountry, returnCity, returnExpertise, returnLanguage);
        persistSearchState({
          country: returnCountry ?? "",
          city: returnCity ?? "",
          expertise: parseExpertiseSelectionInput(returnExpertise),
          language: returnLanguage ?? "all",
          hasSearched: parseExpertiseSelectionInput(returnExpertise).length > 0,
        });
      } else {
        restoreStoredSearchState();
      }
      return;
    }

    const isDayPassReturn =
      searchParams.get("day_pass") === "1" || searchParams.get("day_pass_return") === "1";

    if (sessionId && !confirmingPayment && confirmedSessionRef.current !== sessionId) {
      applyReturnFilters(returnCountry, returnCity, returnExpertise, returnLanguage);
      confirmedSessionRef.current = sessionId;
      setConfirmingPayment(true);
      setDayPassConfirmError(null);
      setDayPassConfirmSuccess(false);

      const confirm = async () => {
        if (isDayPassReturn) {
          const result = await confirmDayPassPayment(sessionId);
          if (result.ok) {
            setDayPassConfirmSuccess(true);
            await refetchUnlocked();
            window.history.replaceState({}, "", "/lawyers");
            return;
          }
          setDayPassConfirmError(result.error ?? t("dayPassConfirmPending"));
          return;
        }

        const res = await fetch("/api/lawyers/confirm-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            session_id: sessionId,
            country: returnCountry ?? undefined,
            expertise: returnExpertise ?? undefined,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setHasSearched(true);
          setShowPaymentChoice(false);
          await refetchUnlocked();
          clearStoredSearchState();
          window.history.replaceState({}, "", "/lawyers");
        }
      };

      void confirm().finally(() => setConfirmingPayment(false));
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
    if (!userLoaded) return;
    refetchUnlocked();
  }, [userLoaded, isAdmin]);

  const expertiseList = useMemo(() => buildExpertiseFilterOptions(lawyers), [lawyers]);

  const filteredLawyers = useMemo(() => {
    return lawyers.filter((lawyer) => {
      if (selectedCountry && lawyer.country !== selectedCountry) return false;
      if (selectedCity.trim()) {
        const q = selectedCity.trim().toLowerCase();
        const city = lawyer.city.toLowerCase();
        if (!city.includes(q)) return false;
      }
      if (!expertiseMatchesAnySelection(lawyer.expertise, selectedExpertise)) return false;
      if (!lawyerSpeaksLanguage(lawyer.primaryLanguage, lawyer.otherLanguages, selectedLanguage)) {
        return false;
      }
      return true;
    });
  }, [lawyers, selectedCountry, selectedCity, selectedExpertise, selectedLanguage]);

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

  const isUnlocked = (lawyer: Lawyer) =>
    lawyerUnlockedForViewer(lawyer, { isAdmin, dayPassActive, unlockedIds });

  const clearFilters = () => {
    setSelectedCountry("");
    setSelectedCity("");
    setSelectedExpertise([]);
    setSelectedLanguage("all");
    setHasSearched(false);
    setShowPaymentChoice(false);
    setShowPawapayCountryPrompt(false);
    setSearchPayError(null);
    clearStoredSearchState();
  };

  const expertiseRequired = selectedExpertise.length === 0;
  const countryRequired = selectedCountry === "";
  const selectedCountrySupportsPawapay =
    selectedCountry !== "" &&
    PAWAPAY_SUPPORTED_COUNTRIES.includes(selectedCountry as (typeof PAWAPAY_SUPPORTED_COUNTRIES)[number]);
  const runSearch = () => {
    if (expertiseRequired || countryRequired) return;
    setHasSearched(true);
    setShowPaymentChoice(true);
    persistSearchState({ hasSearched: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {confirmingPayment && (
        <div className="border-b border-border bg-primary/10 px-4 py-3">
          <div className="mx-auto flex max-w-7xl items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {tCommon("confirmingPayment")}
          </div>
        </div>
      )}
      {dayPassConfirmSuccess && (
        <div className="border-b border-emerald-500/30 bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30">
          <p className="mx-auto max-w-7xl text-sm font-medium text-emerald-900 dark:text-emerald-100">
            {t("dayPassActiveBanner")}{" "}
            <Link href="/ai-research" className="underline">
              {t("openAiResearch")}
            </Link>
          </p>
        </div>
      )}
      {dayPassConfirmError && (
        <div className="border-b border-amber-500/30 bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
          <p className="mx-auto max-w-7xl text-sm text-amber-950 dark:text-amber-100">{dayPassConfirmError}</p>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-visible border-b border-border bg-[#0D1B2A]">
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundImage: PROTOTYPE_HERO_GRID_PATTERN }}
          aria-hidden
        />
        <div className="relative z-[1] mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-14 lg:px-8">
          <div className="max-w-3xl">
            <p className={prototypeHeroEyebrowClass}>
              {t("eyebrow")}
            </p>
            <h1 className="heading mt-6 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[2rem]">
              {t("title")}
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/[0.62] sm:text-base">
              {t("subtitle")}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <LawyersOnboardingVideo className="inline-flex items-center gap-2 rounded-[6px] border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15" />
              <Link
                href="/lawyers/unlocked"
                className="inline-flex items-center rounded-[6px] border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                {t("viewUnlocked")}
              </Link>
            </div>
          </div>
          <div className="relative z-[1] mt-7 overflow-visible rounded-[10px] border border-white/15 bg-white/10 p-3 backdrop-blur">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  {t("country")}
                </label>
                <select
                  className="w-full rounded-[6px] border border-white/20 bg-[#13263a] px-3 py-2 text-sm text-white outline-none"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                >
                  <option value="">{t("selectCountry")}</option>
                  {AFRICAN_COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  {t("areaOfExpertise")}
                </label>
                <LawyerPracticeAreaMultiSelect
                  options={expertiseList}
                  value={selectedExpertise}
                  onChange={setSelectedExpertise}
                  placeholder={t("selectPracticeAreas")}
                  selectedCountLabel={(count) => t("practiceAreasSelected", { count })}
                  formatOption={practiceAreaLabel}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  {t("city")}
                </label>
                <input
                  type="text"
                  placeholder={t("cityPlaceholder")}
                  className="w-full rounded-[6px] border border-white/20 bg-[#13263a] px-3 py-2 text-sm text-white placeholder:text-white/45 outline-none"
                  value={selectedCity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedCity(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  {t("language")}
                </label>
                <select
                  className="w-full rounded-[6px] border border-white/20 bg-[#13263a] px-3 py-2 text-sm text-white outline-none"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                >
                  {LANGUAGE_OPTION_VALUES.map(({ value, messageKey }) => (
                    <option key={value} value={value}>
                      {t(messageKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={runSearch}
                  disabled={expertiseRequired || countryRequired}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[6px] bg-[#0D1B2A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#162436] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                  {t("search")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filters + results */}
      <section className="pb-16 pt-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-start gap-2 rounded-[8px] border border-border bg-card px-4 py-3 text-[16px] text-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p>
              {t.rich("infoSelectCountryPractice", richTags)}
            </p>
          </div>

          <div className="mb-5 rounded-[10px] border-l-4 border-[#C8922A] bg-muted px-7 py-8">
            <p className="flex items-center gap-4 font-serif text-[44px] text-[#C8922A]">
              <Quote className="h-6 w-6 fill-current" />
              <span className="text-[44px] leading-tight text-foreground">
                {t("quoteMandates")}
              </span>
            </p>
          </div>

          <div className="mb-8 flex items-start gap-3 rounded-[8px] border border-border bg-card px-5 py-4 text-[16px] leading-relaxed text-muted-foreground">
            <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <p>
              {t.rich("disclaimerDirectory", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
          </div>

          {(expertiseRequired || countryRequired) && (
            <div className="mb-8">
              {expertiseRequired && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {t.rich("validationPracticeArea", richTags)}
                </p>
              )}
              {!expertiseRequired && countryRequired && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {t("validationCountryAndArea")}
                </p>
              )}
            </div>
          )}

          {/* Before search: prompt user to enter criteria */}
          {!hasSearched && (
            <div className="rounded-2xl border border-dashed border-border/80 bg-card/90 p-8 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">
                {t.rich("promptBeforeSearch", richTags)}
              </p>
            </div>
          )}

        {/* Pay $5 for this search — show when user has searched with a specific expertise, there are results, and at least one is locked */}
        {hasSearched && selectedExpertise.length > 0 && filteredLawyers.length > 0 && (() => {
          const allUnlocked = filteredLawyers.every((l) => isUnlocked(l));
          if (allUnlocked) {
            return (
              <div className="mb-6 rounded-xl border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-200">
                <p>
                  {t("allUnlockedBanner", { count: filteredLawyers.length })}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center rounded-lg border border-green-700/30 bg-white/80 px-3 py-1.5 text-xs font-semibold text-green-900 transition hover:bg-white dark:border-green-400/30 dark:bg-green-950/40 dark:text-green-100 dark:hover:bg-green-950/60"
                  >
                    {t("startNewSearch")}
                  </button>
                  <Link
                    href="/lawyers/unlocked"
                    className="text-xs font-semibold text-green-800 underline underline-offset-2 hover:no-underline dark:text-green-200"
                  >
                    {t("viewUnlocked")}
                  </Link>
                </div>
              </div>
            );
          }
          return (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm">
              <div className="max-w-xl">
                <p className="text-sm font-semibold text-foreground">
                  {t("lawyersMatchCriteria", { count: filteredLawyers.length })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {t.rich("payToUnlockSearch", {
                    ...richTags,
                    count: filteredLawyers.length,
                    country: selectedCountry,
                    areas: selectedExpertise.map(practiceAreaLabel).join(", "),
                  })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {searchPayError && <p className="text-xs text-red-600 sm:text-sm">{searchPayError}</p>}
                {showPaymentChoice ? (
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-xs text-muted-foreground">{t("choosePaymentMethodPrompt")}</p>
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
                        {t("paymentMobileMoney")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!lomiAvailable) return;
                          void handlePayForSearch("lomi");
                        }}
                        disabled={searchPayLoading || !lomiAvailable}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#635BFF]/50 bg-[#635BFF]/10 px-4 py-2 text-xs font-semibold text-[#635BFF] transition hover:bg-[#635BFF]/20 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                      >
                        {searchPayLoading && paymentProvider === "lomi" && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        {!searchPayLoading && <CreditCard className="h-4 w-4" />}
                        {t("paymentCard")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPaymentChoice(false)}
                        disabled={searchPayLoading}
                        className="inline-flex items-center justify-center rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/60 hover:bg-primary/5 hover:text-foreground"
                      >
                        {t("paymentCancel")}
                      </button>
                    </div>
                    {!selectedCountrySupportsPawapay && selectedCountry !== "" && lomiAvailable && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {t("mobileMoneyUnavailableForCountry", { country: selectedCountry })}
                      </p>
                    )}
                    {!lomiAvailable && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {t("cardCheckoutUnavailable")}
                      </p>
                    )}
                    {showPawapayCountryPrompt && selectedCountrySupportsPawapay && (
                      <div className="mt-2 w-full rounded-xl border border-emerald-600/30 bg-emerald-50 p-3 dark:bg-emerald-900/20">
                        <label className="mb-2 block text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          {t("selectMobileMoneyCountry")}
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
                            {t("paymentContinue")}
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
                    {t("choosePaymentMethod")}
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {hasSearched && (
          <div className="mb-4 text-xs text-muted-foreground">
            {t("showingVerifiedLawyers", { count: filteredLawyers.length })}
          </div>
        )}
        {searchParams.get("canceled") === "1" && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 sm:text-sm">
            {t("paymentCanceledBanner")}
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
              {selectedCountry ? t("noLawyersInCountry") : t("noLawyersFound")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedCountry
                ? t("noLawyersInCountryHint", { country: selectedCountry })
                : t("adjustFiltersHint")}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-6 inline-flex items-center justify-center rounded-xl border border-primary/70 bg-primary/10 px-6 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary hover:bg-primary/20"
            >
              {t("resetSearch")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {filteredLawyers.map((lawyer) => {
              const unlocked = isUnlocked(lawyer);
              const contacts = contactsByLawyer[lawyer.id];
              const expertiseTags = dedupeExpertiseSegments(parseExpertiseSegments(lawyer.expertise));
              const lawyerLanguages = collectLawyerLanguages(lawyer.primaryLanguage, lawyer.otherLanguages);
              const initials = lawyer.name.split(" ").map((n) => n[0]).filter(Boolean).join("");
              const initialsDisplay = lawyer.name.split(" ").map((n) => n[0]).filter(Boolean).join(". ") + ".";

              return (
                <div
                  key={lawyer.id}
                  className="group overflow-hidden rounded-[10px] border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
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
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {t("verified")}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground sm:text-[13px]">
                          {[lawyer.city, lawyer.country].filter(Boolean).join(", ") || lawyer.country}
                          {lawyerLanguages.length > 0 ? (
                            <>
                              {" · "}
                              {formatLocalizedLawyerLanguages(lawyerLanguages)}
                            </>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <Star className="h-4 w-4 fill-current text-yellow-500" />
                          {reviewsByLawyer[lawyer.id]?.totalReviews > 0 ? (
                            <>
                              <span className="text-sm font-semibold text-foreground">
                                {reviewsByLawyer[lawyer.id].averageRating.toFixed(1)}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                ({t("reviewCount", { count: reviewsByLawyer[lawyer.id].totalReviews })})
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-bold text-foreground">—</span>
                              <span className="text-sm text-muted-foreground">{t("noRatingsYet")}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {expertiseTags.map((exp) => (
                        <span
                          key={exp}
                          className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                        >
                          {practiceAreaLabel(exp)}
                        </span>
                      ))}
                    </div>
                    {lawyerLanguages.length > 0 ? (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {lawyerLanguages.map((language) => (
                          <span
                            key={language}
                            className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-medium text-foreground"
                          >
                            {lawyerLanguageLabel(language)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      <div className="rounded-[6px] border border-border bg-background px-2 py-2 text-center">
                        <div className="text-sm font-bold text-foreground">{pseudoYears(lawyer.name)}</div>
                        <div className="text-[10px] text-muted-foreground">{t("yearsExperience")}</div>
                      </div>
                      <div className="rounded-[6px] border border-border bg-background px-2 py-2 text-center">
                        <div className="text-sm font-bold text-foreground">{pseudoCountries(lawyer.name)}</div>
                        <div className="text-[10px] text-muted-foreground">{t("countriesStat")}</div>
                      </div>
                      <div className="rounded-[6px] border border-border bg-background px-2 py-2 text-center">
                        <div className="text-sm font-bold text-foreground">
                          {formatLawyerLanguagesAbbrev(lawyerLanguages)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {lawyerLanguages.length === 1 ? t("languageSingular") : t("languagePlural")}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-border pt-3">
                      {unlocked ? (
                        <div className="space-y-1.5 text-xs text-muted-foreground">
                          {contacts?.email && <div>📧 {contacts.email}</div>}
                          {contacts?.phone && <div>📱 {contacts.phone}</div>}
                          {contacts?.contacts && <div className="whitespace-pre-wrap">💼 {contacts.contacts}</div>}
                          {!contacts?.email && !contacts?.phone && !contacts?.contacts && (
                            <div>{t("noContactDetailsOnFile")}</div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-[6px] bg-[#0D1B2A] px-3 py-2 text-center text-[12px] font-semibold text-white">
                          {t.rich("unlockContactPrice", richTags)}
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
            {t.rich("perSearchFooter", richTags)}
          </p>
        )}
        </div>
      </section>
    </div>
  );
}
