"use client";

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  startTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  filterAiResearchSourceCardsForDisplay,
  filterAiResearchSourcesForDisplay,
  isAiResearchMethodologySourceCard,
} from "@/lib/ai-research-source-cards";
import { useClientSearchParams } from "@/lib/use-client-search-params";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";
import { useAppUser } from "@/components/auth/AppAuthProvider";
import {
  Pencil,
  Menu,
  Share2,
  Download,
  Users,
  Loader2,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  UserCircle2,
  ChevronDown,
  PanelLeft,
} from "lucide-react";
import { canShareByEmail, canDownloadConversations } from "@/lib/plan-limits";
import { plainTextForAiChatExport } from "@/lib/ai-chat-plain-text";
import {
  formatAssistantAnswerForDisplay,
  type DocTitleBySlot,
} from "@/lib/ai-citation-verify";
import { downloadAiResearchChatPdf } from "@/lib/ai-research-chat-pdf";
import { AIResearchChatExportPreviewDialog } from "@/components/ai-research/AIResearchChatExportPreviewDialog";
import { SubscriptionCheckoutConfirm } from "@/components/checkout/SubscriptionCheckoutConfirm";
import {
  clearPaygAiQueryLomiSessionIdStorage,
  parsePaygAiQueryReturn,
} from "@/lib/lomi-payg-ai-query-return";
import { usePlatformSettings } from "@/components/platform/PlatformSettingsContext";
import { AiChatStoppedError, parseAiChatResponse } from "@/lib/ai-chat-client-stream";
import {
  finalizeProcessLog,
  mergeProcessStep,
  type AiProcessSsePayload,
  type AiProcessStep,
} from "@/lib/ai-chat-process";
import { AiResearchProcessPanel } from "@/components/ai-research/AiResearchProcessPanel";
import { AiResearchMessageFootnotes } from "@/components/ai-research/AiResearchMessageFootnotes";
import { AiResearchPlanLanding } from "@/components/ai-research/AiResearchPlanLanding";
import { AiResearchComposer } from "@/components/ai-research/AiResearchComposer";
import { AiResearchEmptyHero } from "@/components/ai-research/AiResearchEmptyHero";
import { pickRandomExampleQuestions } from "@/lib/ai-research-example-prompts";
import { AiResearchSidebar } from "@/components/ai-research/AiResearchSidebar";
import {
  AIResearchShellStylesProvider,
  useAIResearchShellStyles,
} from "@/components/ai-research/AIResearchShellStylesContext";
import {
  translateAiProcessStepDetail,
  translateAiProcessStepMessage,
} from "@/lib/i18n/translate-ai-process-step";
import {
  resolveAiResearchContentGap,
  type AiResearchContentGap,
  type AiResearchLawyerNudge,
} from "@/lib/ai-research-user-messaging";
import * as Dialog from "@radix-ui/react-dialog";

type Tier = "free" | "basic" | "pro" | "team";

const TIER_LIMITS: Record<Tier, number | null> = {
  free: 0,
  basic: 10,
  pro: 50,
  team: null,
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  sourceCards?: Array<{
    lawId: string;
    title: string;
    country: string;
    category: string;
    status: string;
    snippet: string;
    usedInAnswer?: boolean;
    docSlot?: number;
    sourceKind?: "law" | "methodology";
  }>;
  contentGap?: AiResearchContentGap | null;
  retrievedLawCount?: number;
  lawyerNudge?: AiResearchLawyerNudge | null;
  queryLogId?: string | null;
  citationVerification?: {
    invalidDocRefs: number[];
    citedDocIndices: number[];
    allDocRefsValid: boolean;
  };
  /** Present when optional Tavily web snippets were merged into the model context for this turn. */
  webSearchNote?: string | null;
  /** Collapsible retrieval / drafting steps (Cursor-style). */
  processLog?: import("@/lib/ai-chat-process").AiProcessStep[];
  processStartedAt?: number;
  processCompletedAt?: number;
  outputConfidence?: "high" | "medium" | "low";
  /** Instrument titles by [doc:N] slot — set when the stream opens, before text deltas. */
  citationLookupCards?: DocTitleBySlot[];
};

function citationLookupForMessage(msg: Message): DocTitleBySlot[] | undefined {
  if (msg.citationLookupCards?.length) return msg.citationLookupCards;
  const fromSourceCards = filterAiResearchSourceCardsForDisplay(msg.sourceCards);
  return fromSourceCards.length > 0 ? fromSourceCards : undefined;
}

type NegativeFeedbackModalState = {
  messageId: string;
  queryLogId?: string | null;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  starred?: boolean;
};

const STORAGE_KEY = "yamale-ai-chats";
const CURRENT_CHAT_ID_KEY = "yamale-ai-current-chat-id";
const SIDEBAR_OPEN_KEY = "yamale-ai-sidebar-open";
const MAX_SESSIONS = 50;
const AI_RESEARCH_NOTICE_VERSION = "v1";
const AI_RESEARCH_NOTICE_KEY = `yamale-ai-research-notice:${AI_RESEARCH_NOTICE_VERSION}`;
const PII_WARNING_VERSION = "v1";
const PII_WARNING_KEY = `yamale-ai-pii-warning:${PII_WARNING_VERSION}`;
const AI_CHAT_TIMEOUT_MS = 110000;
/** mailto URLs above ~2k chars often fail in Gmail (413 / blank page). */
const MAILTO_BODY_INTRO =
  "Shared from Yamalé AI Legal Research.\n\nThe full conversation is on your clipboard — paste it here with Cmd+V or Ctrl+V.\n\n---\n\n";

function getTierFromUser(metadata: Record<string, unknown> | undefined): Tier {
  const t = metadata?.tier ?? metadata?.subscriptionTier;

  // Temporary 24-hour day pass upgrade
  const dayPassExpiry = metadata?.day_pass_expires_at;
  if (typeof dayPassExpiry === "string") {
    const expiresAt = new Date(dayPassExpiry).getTime();
    if (!Number.isNaN(expiresAt) && Date.now() < expiresAt) {
      // Treat active day pass as Pro-level access
      return "pro";
    }
  }

  if (t === "pro") return "pro";
  if (t === "team" || t === "plus") return "team"; // plus legacy → Team
  if (t === "basic") return "basic";
  return "free";
}

function normalizeSessionMessages(sessions: ChatSession[]): ChatSession[] {
  return sessions.map((session) => ({
    ...session,
    starred: Boolean(session.starred),
    messages: session.messages.map((message) => ({
      ...message,
      sources: filterAiResearchSourcesForDisplay(message.sources),
      sourceCards: filterAiResearchSourceCardsForDisplay(message.sourceCards),
    })),
  }));
}

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return Array.isArray(parsed) ? normalizeSessionMessages(parsed.slice(0, MAX_SESSIONS)) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // ignore
  }
}

/** Latest user turn in a thread — top of the last Q&A when reopening from history. */
function getLastExchangeScrollMessageId(messages: Message[]): string | undefined {
  if (!messages.length) return undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].id;
  }
  return messages[messages.length - 1]?.id;
}

export default function AIResearchClient() {
  const t = useTranslations("aiResearch");
  const tLoading = useTranslations("loading");
  const tCommon = useTranslations("common");
  const tierLabels = useMemo(
    (): Record<Tier, string> => ({
      free: t("tiers.free"),
      basic: t("tiers.basic"),
      pro: t("tiers.pro"),
      team: t("tiers.team"),
    }),
    [t]
  );
  const { user, isLoaded } = useAppUser();
  const searchParams = useClientSearchParams();
  const chatStorageReadyRef = useRef(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [exampleQuestions, setExampleQuestions] = useState<string[]>(() =>
    pickRandomExampleQuestions(4)
  );
  const [searchChats, setSearchChats] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [chatCopied, setChatCopied] = useState(false);
  const [emailShareOpening, setEmailShareOpening] = useState(false);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [exportPreviewAt, setExportPreviewAt] = useState<Date | null>(null);
  const [chatPdfDownloading, setChatPdfDownloading] = useState(false);
  const [aiUsage, setAiUsage] = useState<{
    used: number;
    limit: number | null;
    remaining: number | null;
    tier?: Tier;
    payAsYouGoCount?: number;
    canQuery?: boolean;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);
  const streamingContentRef = useRef("");
  /** When "live", skip history restore so send/reply scrolling is not overridden. */
  const historyScrollModeRef = useRef<"history" | "live">("history");
  const historyScrollDoneFingerprintRef = useRef<string | null>(null);
  const paygConfirmAttemptRef = useRef<string | null>(null);
  const usageFetchGenRef = useRef(0);
  /** Legacy name kept defined (some HMR/cache paths still touch it); do not use for the attempt key. */
  const paygConfirmInFlightRef = useRef(false);
  /** Do not put `confirmingPayment` in the payg effect deps — it re-runs cleanup, cancels the fetch, and `finally` used to skip clearing the UI (stuck on "Confirming payment…"). */
  const mounted = useRef(false);
  const [mobileKeyboardInset, setMobileKeyboardInset] = useState(0);
  const [shellViewportHeight, setShellViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    const viewport = typeof window !== "undefined" ? window.visualViewport : null;
    if (!viewport) return;

    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setMobileKeyboardInset(inset);
      setShellViewportHeight(viewport.height + viewport.offsetTop);
    };

    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);
    updateInset();
    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
    };
  }, []);

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = chatScrollRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior });
      });
    });
  }, []);

  /** Align the top of a message under the chat header (used when opening history). */
  const scrollMessageTopIntoChatPane = useCallback(
    (messageId: string, behavior: ScrollBehavior = "smooth", onDone?: () => void) => {
      const pad = 12;
      const maxSteps = 60;
      let step = 0;
      const run = () => {
        step += 1;
        const scrollEl = chatScrollRef.current;
        const target = document.getElementById(`msg-${messageId}`);
        if (scrollEl && target && scrollEl.contains(target)) {
          const sr = scrollEl.getBoundingClientRect();
          const tr = target.getBoundingClientRect();
          const nextTop = scrollEl.scrollTop + (tr.top - sr.top) - pad;
          scrollEl.scrollTo({ top: Math.max(0, nextTop), behavior });
          onDone?.();
          return;
        }
        if (step < maxSteps) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
    },
    []
  );
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const paygReturn = useMemo(() => parsePaygAiQueryReturn(searchParams), [searchParams]);
  const [paygAccessPending, setPaygAccessPending] = useState(false);
  const [showPayAsYouGoPrompt, setShowPayAsYouGoPrompt] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; display_name?: string }>>([]);
  const [defaultModelId, setDefaultModelId] = useState<string | null>(null);
  const [allowedModelIds, setAllowedModelIds] = useState<string[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [feedbackBusyId, setFeedbackBusyId] = useState<string | null>(null);
  const [feedbackChoiceById, setFeedbackChoiceById] = useState<Record<string, 1 | -1>>({});
  const [negativeModal, setNegativeModal] = useState<NegativeFeedbackModalState | null>(null);
  const [negativeIssueCategory, setNegativeIssueCategory] = useState("");
  const [negativeIssueDetails, setNegativeIssueDetails] = useState("");
  const [negativeSubmitting, setNegativeSubmitting] = useState(false);
  const [noticeCheckDone, setNoticeCheckDone] = useState(false);
  const [hasAcknowledgedNotice, setHasAcknowledgedNotice] = useState(false);
  const [piiWarningDismissed, setPiiWarningDismissed] = useState(false);
  const [shellTopOffset, setShellTopOffset] = useState(72);

  const tierFromMetadata: Tier =
    user?.publicMetadata ? getTierFromUser(user.publicMetadata as Record<string, unknown>) : "free";
  const tier = (aiUsage?.tier as Tier | undefined) ?? tierFromMetadata;
  const limit = aiUsage?.limit ?? TIER_LIMITS[tier];
  const currentSession = sessions.find((s) => s.id === currentId);
  const messages = currentSession?.messages ?? [];
  const isTurnBusy = Boolean(streamingAssistantId);

  const stopGenerating = useCallback(() => {
    if (!streamingAssistantId) return;
    stopRequestedRef.current = true;
    chatAbortRef.current?.abort();
  }, [streamingAssistantId]);

  const handleEditUserMessage = useCallback(
    (messageId: string) => {
      if (isTurnBusy || !currentId) return;
      const session = sessions.find((s) => s.id === currentId);
      if (!session) return;
      const idx = session.messages.findIndex((m) => m.id === messageId);
      if (idx < 0 || session.messages[idx]?.role !== "user") return;
      const content = session.messages[idx].content;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentId
            ? { ...s, messages: s.messages.slice(0, idx), updatedAt: Date.now() }
            : s
        )
      );
      setInput(content);
      historyScrollModeRef.current = "live";
      requestAnimationFrame(() => composerTextareaRef.current?.focus());
    },
    [isTurnBusy, currentId, sessions]
  );
  const used = aiUsage?.used ?? 0;
  const remaining = aiUsage?.remaining ?? (limit === null ? null : Math.max(0, limit - used));
  const payAsYouGoCount = aiUsage?.payAsYouGoCount ?? 0;
  const canQuery = aiUsage?.canQuery ?? true;
  // User is at limit only if they can't query (no plan limit remaining AND no pay-as-you-go purchases)
  const atLimit = !canQuery;
  const [usageFetched, setUsageFetched] = useState(false);
  const [clerkLoadTimedOut, setClerkLoadTimedOut] = useState(false);
  const { logoUrl: platformLogoUrl } = usePlatformSettings();
  /** Usage may load in the background once Clerk is ready; do not block the shell forever. */
  const effectiveTierLoaded = !isLoaded || usageFetched;

  const filteredSessions = searchChats.trim()
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(searchChats.toLowerCase()) ||
          s.messages.some((m) => m.content.toLowerCase().includes(searchChats.toLowerCase()))
      )
    : sessions;

  const { starredSessions, recentSessions } = useMemo(() => {
    const sorted = [...filteredSessions].sort((a, b) => b.updatedAt - a.updatedAt);
    return {
      starredSessions: sorted.filter((s) => s.starred),
      recentSessions: sorted.filter((s) => !s.starred),
    };
  }, [filteredSessions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(SIDEBAR_OPEN_KEY);
      if (saved === "0") {
        setSidebarOpen(false);
      } else if (saved === "1") {
        setSidebarOpen(true);
      } else if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    } catch {
      if (window.innerWidth < 768) setSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(SIDEBAR_OPEN_KEY, sidebarOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sidebarOpen]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
    }
  }, []);

  useEffect(() => {
    const loaded = loadSessions();
    if (loaded.length > 0) {
      setSessions(loaded);
      try {
        const saved = localStorage.getItem(CURRENT_CHAT_ID_KEY);
        if (saved && loaded.some((s) => s.id === saved)) {
          setCurrentId(saved);
        }
      } catch {
        /* ignore */
      }
    }
    chatStorageReadyRef.current = true;
  }, []);

  useEffect(() => {
    if (!chatStorageReadyRef.current) return;
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (currentId) localStorage.setItem(CURRENT_CHAT_ID_KEY, currentId);
      else localStorage.removeItem(CURRENT_CHAT_ID_KEY);
    } catch {
      /* ignore */
    }
  }, [currentId]);

  // Scroll when a new turn starts (assistant placeholder appears).
  useEffect(() => {
    if (!streamingAssistantId) return;
    scrollChatToBottom("auto");
  }, [streamingAssistantId, scrollChatToBottom]);

  // Opening a different chat should restore history scroll (not live reply scrolling).
  useEffect(() => {
    historyScrollModeRef.current = "history";
    historyScrollDoneFingerprintRef.current = null;
  }, [currentId]);

  // Restore scroll to the latest Q&A when opening history or after refresh hydrates sessions from the API.
  useLayoutEffect(() => {
    if (!currentId || isTurnBusy || historyScrollModeRef.current !== "history") return;
    const session = sessions.find((s) => s.id === currentId);
    if (!session?.messages.length) return;
    const scrollId = getLastExchangeScrollMessageId(session.messages);
    if (!scrollId) return;
    const fingerprint = `${currentId}:${session.messages.length}:${scrollId}`;
    if (historyScrollDoneFingerprintRef.current === fingerprint) return;
    scrollMessageTopIntoChatPane(scrollId, "auto", () => {
      historyScrollDoneFingerprintRef.current = fingerprint;
    });
  }, [currentId, sessions, isTurnBusy, scrollMessageTopIntoChatPane]);

  const fetchAiUsage = useCallback(async () => {
    if (!user) return null;
    const gen = ++usageFetchGenRef.current;
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      const res = await fetch("/api/ai/usage", {
        credentials: "include",
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const data = (await res.json()) as {
        used?: number;
        limit?: number | null;
        remaining?: number | null;
        tier?: string;
        payAsYouGoCount?: number;
        canQuery?: boolean;
      };
      if (!res.ok || gen !== usageFetchGenRef.current) return null;
      const snapshot = {
        used: data.used ?? 0,
        limit: data.limit ?? null,
        remaining: data.remaining ?? null,
        tier: (data.tier as Tier) ?? undefined,
        payAsYouGoCount: data.payAsYouGoCount ?? 0,
        canQuery: data.canQuery ?? true,
      };
      setAiUsage(snapshot);
      return snapshot;
    } catch {
      return null;
    } finally {
      if (gen === usageFetchGenRef.current) {
        setUsageFetched(true);
      }
    }
  }, [user]);

  useEffect(() => {
    setPaygAccessPending(Boolean(paygReturn?.canConfirm));
  }, [paygReturn?.canConfirm, paygReturn?.confirmationKey]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setUsageFetched(true);
      return;
    }
    if (paygAccessPending) return;
    setUsageFetched(false);
    void fetchAiUsage();
  }, [isLoaded, user, fetchAiUsage, paygAccessPending]);

  useEffect(() => {
    if (isLoaded) {
      setClerkLoadTimedOut(false);
      return;
    }
    const t = window.setTimeout(() => setClerkLoadTimedOut(true), 12_000);
    return () => window.clearTimeout(t);
  }, [isLoaded]);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/models", { credentials: "include" });
      const data = (await res.json()) as {
        models?: Array<{ id: string; display_name?: string }>;
        defaultModelId?: string | null;
        allowedModelIds?: string[];
      };
      if (res.ok && data.models?.length) {
        setModels(data.models);
        const allowed = data.allowedModelIds ?? [];
        setAllowedModelIds(allowed);
        const defaultId = data.defaultModelId ?? data.models[0]?.id ?? null;
        setDefaultModelId(defaultId);
        setSelectedModelId(defaultId ?? data.models?.[0]?.id ?? null);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchModels();
  }, [user, fetchModels]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateShellOffset = () => {
      const header = document.querySelector("header");
      if (!header) {
        setShellTopOffset(72);
        return;
      }
      const rect = header.getBoundingClientRect();
      setShellTopOffset(Math.max(48, Math.round(rect.bottom)));
    };

    updateShellOffset();
    window.addEventListener("resize", updateShellOffset);
    window.addEventListener("scroll", updateShellOffset, { passive: true });
    window.visualViewport?.addEventListener("resize", updateShellOffset);
    return () => {
      window.removeEventListener("resize", updateShellOffset);
      window.removeEventListener("scroll", updateShellOffset);
      window.visualViewport?.removeEventListener("resize", updateShellOffset);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setHasAcknowledgedNotice(true);
      setNoticeCheckDone(true);
      return;
    }
    try {
      const raw = localStorage.getItem(AI_RESEARCH_NOTICE_KEY);
      const acknowledgedUsers = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      setHasAcknowledgedNotice(Boolean(acknowledgedUsers[user.id]));
    } catch {
      setHasAcknowledgedNotice(false);
    } finally {
      setNoticeCheckDone(true);
    }
  }, [user]);

  useEffect(() => {
    try {
      setPiiWarningDismissed(localStorage.getItem(PII_WARNING_KEY) === "1");
    } catch {
      setPiiWarningDismissed(false);
    }
  }, []);

  const dismissPiiWarning = () => {
    setPiiWarningDismissed(true);
    try {
      localStorage.setItem(PII_WARNING_KEY, "1");
    } catch {
      // ignore
    }
  };

  // Handle payment confirmation after PawaPay (session_id) or Lomi (cookie + from_lomi=1)
  useEffect(() => {
    if (!paygReturn || !user) {
      if (!paygReturn?.canConfirm) setPaygAccessPending(false);
      return;
    }
    if (!paygReturn.canConfirm) {
      setPaygAccessPending(false);
      return;
    }
    const { confirmationKey, sessionId, useLomiCookie } = paygReturn;
    if (paygConfirmAttemptRef.current === confirmationKey) return;
    paygConfirmAttemptRef.current = confirmationKey;

    let cancelled = false;
    usageFetchGenRef.current += 1;
    setConfirmingPayment(true);
    setPaygAccessPending(true);
    const body = sessionId
      ? { session_id: sessionId }
      : { from_lomi_cookie: true as const };

    void (async () => {
      const maxAttempts = 4;
      try {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (cancelled) return;
          const res = await fetch("/api/ai/confirm-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
          });
          const data = (await res.json()) as { ok?: boolean; error?: string };
          if (res.ok && data.ok) {
            if (cancelled) return;
            clearPaygAiQueryLomiSessionIdStorage();
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (cancelled) return;
            for (let usageAttempt = 0; usageAttempt < 5; usageAttempt++) {
              const usage = await fetchAiUsage();
              if ((usage?.payAsYouGoCount ?? 0) > 0 || usage?.canQuery) break;
              if (usageAttempt < 4) {
                await new Promise((resolve) => setTimeout(resolve, 800));
              }
            }
            window.history.replaceState({}, "", "/ai-research");
            window.dispatchEvent(new PopStateEvent("popstate"));
            return;
          }
          if (res.status === 409 && attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
          throw new Error(data.error || "Failed to confirm payment");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to confirm payment:", err);
          clearPaygAiQueryLomiSessionIdStorage();
          await fetchAiUsage();
          window.history.replaceState({}, "", "/ai-research");
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      } finally {
        if (!cancelled) {
          setConfirmingPayment(false);
          setPaygAccessPending(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      // React Strict Mode: remount must be allowed to confirm the same return URL again.
      if (paygConfirmAttemptRef.current === confirmationKey) {
        paygConfirmAttemptRef.current = null;
      }
    };
  }, [paygReturn, user, fetchAiUsage]);

  // Load sessions from backend for signed-in users
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/ai/chats", {
          credentials: "include",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { sessions?: ChatSession[] };
        if (!cancelled && Array.isArray(json.sessions) && json.sessions.length > 0) {
          let savedId: string | null = null;
          try {
            savedId = localStorage.getItem(CURRENT_CHAT_ID_KEY);
          } catch {
            savedId = null;
          }
          setSessions(normalizeSessionMessages(json.sessions));
          if (savedId && json.sessions.some((s) => s.id === savedId)) {
            setCurrentId(savedId);
          }
        }
      } catch {
        // ignore and rely on localStorage fallback
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Persist sessions to backend when they change (debounced) for signed-in users
  useEffect(() => {
    if (!user || sessions.length === 0) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch("/api/ai/chats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessions }),
        signal: controller.signal,
      }).catch(() => {
        // ignore
      });
    }, 800);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [sessions, user]);

  const fillComposerPrompt = useCallback((text: string) => {
    setInput(text);
    requestAnimationFrame(() => {
      const el = composerTextareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    });
  }, []);

  const newChat = useCallback(() => {
    setCurrentId(null);
    setInput("");
    setExampleQuestions(pickRandomExampleQuestions(4));
  }, []);

  const selectChat = useCallback((id: string) => {
    setCurrentId(id);
    // Keep sidebar open; user can close it via X or menu if they want
  }, []);

  const deleteChat = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentId === id) {
      setCurrentId(null);
    }
  }, [currentId]);

  const toggleChatStarred = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, starred: !s.starred, updatedAt: Date.now() } : s
      )
    );
  }, []);

  const getChatTranscript = useCallback(() => {
    if (!currentSession) return "";
    return currentSession.messages
      .map((m) => {
        const label = m.role === "user" ? "You" : "Yamalé AI";
        const text =
          m.role === "assistant"
            ? plainTextForAiChatExport(
                formatAssistantAnswerForDisplay(m.content, citationLookupForMessage(m))
              )
            : m.content;
        return `${label}: ${text}`;
      })
      .join("\n\n");
  }, [currentSession]);

  const handleShareEmail = useCallback(async () => {
    const transcript = getChatTranscript();
    const subject = currentSession?.title || "AI Legal Research chat";
    setEmailShareOpening(true);
    try {
      await navigator.clipboard.writeText(transcript);
    } catch {
      // mailto can still open; user may paste manually if clipboard fails
    }
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(MAILTO_BODY_INTRO)}`;
    window.location.href = mailto;
    window.setTimeout(() => {
      setEmailShareOpening(false);
      setShareOpen(false);
    }, 400);
  }, [currentSession, getChatTranscript]);

  const handleCopyChat = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getChatTranscript());
      setChatCopied(true);
      window.setTimeout(() => {
        setChatCopied(false);
        setShareOpen(false);
      }, 1500);
    } catch {
      // ignore
    }
  }, [getChatTranscript]);

  const handleCopyMessage = useCallback(async (messageId: string, text: string, role: Message["role"]) => {
    try {
      const plain =
        role === "assistant"
          ? plainTextForAiChatExport(
              formatAssistantAnswerForDisplay(
                text,
                citationLookupForMessage(
                  currentSession?.messages.find((m) => m.id === messageId) ?? {
                    id: messageId,
                    role: "assistant",
                    content: text,
                  }
                )
              )
            )
          : text;
      await navigator.clipboard.writeText(plain);
      setCopiedMessageId(messageId);
      setTimeout(() => {
        setCopiedMessageId((prev) => (prev === messageId ? null : prev));
      }, 1500);
    } catch {
      // ignore clipboard errors
    }
  }, [currentSession]);

  const handleDownloadChat = useCallback(async () => {
    if (!currentSession || chatPdfDownloading) return;
    setChatPdfDownloading(true);
    try {
      await downloadAiResearchChatPdf({
        title: currentSession.title || "AI Legal Research",
        messages: currentSession.messages.map((m) => ({
          role: m.role,
          content: m.content,
          sources: filterAiResearchSourcesForDisplay(m.sources),
          sourceCards: filterAiResearchSourceCardsForDisplay(m.sourceCards),
        })),
        generatedAt: new Date(),
      });
    } catch (err) {
      console.error("Chat PDF export failed:", err);
    } finally {
      setChatPdfDownloading(false);
    }
  }, [currentSession, chatPdfDownloading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || (atLimit && limit !== null) || !hasAcknowledgedNotice) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    const assistantId = `assistant-${Date.now()}`;
    const processStartedAt = Date.now();
    const assistantPlaceholder: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      sources: [],
      sourceCards: [],
      processLog: [
        { step: "understand", message: "Reading your question", status: "active", at: processStartedAt },
        {
          step: "library",
          message: "Searching the Yamalé legal library…",
          status: "active",
          at: processStartedAt + 1,
        },
      ],
      processStartedAt,
    };

    let sessionIdToUpdate = currentId;
    if (!currentId) {
      const newSession: ChatSession = {
        id: `chat-${Date.now()}`,
        title: (trimmed.slice(0, 60) || "New chat") + (trimmed.length > 60 ? "…" : ""),
        messages: [userMessage, assistantPlaceholder],
        updatedAt: Date.now(),
      };
      sessionIdToUpdate = newSession.id;
      setSessions((prev) => [newSession, ...prev]);
      setCurrentId(newSession.id);
    } else {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentId
            ? {
                ...s,
                messages: [...s.messages, userMessage, assistantPlaceholder],
                title: s.messages.length === 0 ? (trimmed.slice(0, 60) || s.title) + (trimmed.length > 60 ? "…" : "") : s.title,
                updatedAt: Date.now(),
              }
            : s
        )
      );
    }
    setInput("");
    historyScrollModeRef.current = "live";
    historyScrollDoneFingerprintRef.current = null;
    setStreamingAssistantId(assistantId);
    setIsLoading(false);
    stopRequestedRef.current = false;
    streamingContentRef.current = "";
    scrollChatToBottom("auto");

    let pendingAssistantScrollId: string | null = assistantId;

    try {
      // Build messages array for API (include conversation history)
      const sessionForApi =
        sessionIdToUpdate != null ? sessions.find((s) => s.id === sessionIdToUpdate) : undefined;
      const currentSessionMessages =
        sessionForApi?.messages.filter((m) => m.id !== userMessage.id) ?? [];
      const apiMessages = [
        ...currentSessionMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        {
          role: "user" as const,
          content: trimmed,
        },
      ];

      // Track pay-as-you-go count before query
      const payAsYouGoBefore = payAsYouGoCount;

      const effectiveModelId = allowedModelIds.includes(selectedModelId ?? "") ? selectedModelId : defaultModelId;
      const chatController = new AbortController();
      chatAbortRef.current = chatController;
      const chatTimeout = setTimeout(() => chatController.abort(), AI_CHAT_TIMEOUT_MS);
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: chatController.signal,
        body: JSON.stringify({
          messages: apiMessages,
          model: effectiveModelId ?? undefined,
          sessionId: sessionIdToUpdate ?? undefined,
        }),
      }).finally(() => clearTimeout(chatTimeout));

      const sessionId = sessionIdToUpdate;

      const streamHandlers = {
        onCitationLookup: (cards: DocTitleBySlot[]) => {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId) return s;
              return {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantId ? { ...m, citationLookupCards: cards } : m
                ),
                updatedAt: Date.now(),
              };
            })
          );
        },
        onProcess: (payload: AiProcessSsePayload) => {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId) return s;
              return {
                ...s,
                messages: s.messages.map((m) => {
                  if (m.id !== assistantId) return m;
                  const log = mergeProcessStep(m.processLog ?? [], payload);
                  return { ...m, processLog: log };
                }),
                updatedAt: Date.now(),
              };
            })
          );
        },
        onDelta: (text: string) => {
          streamingContentRef.current += text;
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId) return s;
              return {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + text } : m
                ),
                updatedAt: Date.now(),
              };
            })
          );
        },
      };

      const { payload: data, streamed } = await parseAiChatResponse(res, streamHandlers, {
        signal: chatController.signal,
      });

      if (!streamed) {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sessionId) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: data.content || "I apologize, but I couldn't generate a response." }
                  : m
              ),
              updatedAt: Date.now(),
            };
          })
        );
      }

      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: data.content || "I apologize, but I couldn't generate a response.",
        sources: filterAiResearchSourcesForDisplay(
          Array.isArray(data.sources) ? (data.sources as string[]) : []
        ),
        sourceCards: filterAiResearchSourceCardsForDisplay(
          Array.isArray(data.sourceCards) ? (data.sourceCards as Message["sourceCards"]) : []
        ),
        contentGap:
          (data.contentGap as Message["contentGap"]) ??
          resolveAiResearchContentGap({
            assistantText: data.content || "",
            userQuery: trimmed,
            effectiveCountry: null,
            retrievedLawCount:
              typeof data.retrievedLawCount === "number"
                ? data.retrievedLawCount
                : filterAiResearchSourceCardsForDisplay(
                    Array.isArray(data.sourceCards) ? (data.sourceCards as Message["sourceCards"]) : []
                  ).length,
            displayedSourceCardCount: filterAiResearchSourceCardsForDisplay(
              Array.isArray(data.sourceCards) ? (data.sourceCards as Message["sourceCards"]) : []
            ).length,
            lawsUsedInAnswerCount: filterAiResearchSourceCardsForDisplay(
              Array.isArray(data.sourceCards) ? (data.sourceCards as Message["sourceCards"]) : []
            ).filter((c) => c.usedInAnswer).length,
          }),
        retrievedLawCount:
          typeof data.retrievedLawCount === "number" ? data.retrievedLawCount : undefined,
        lawyerNudge: (data.lawyerNudge as Message["lawyerNudge"]) ?? null,
        queryLogId: typeof data.queryLogId === "string" ? data.queryLogId : null,
        citationVerification:
          data.citationVerification && typeof data.citationVerification === "object"
            ? (data.citationVerification as Message["citationVerification"])
            : undefined,
        webSearchNote: typeof data.webSearchNote === "string" ? data.webSearchNote : null,
        outputConfidence:
          data.outputConfidence === "high" ||
          data.outputConfidence === "medium" ||
          data.outputConfidence === "low"
            ? data.outputConfidence
            : undefined,
        processStartedAt,
      };

      const completedAt = Date.now();
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantId
                    ? {
                        ...assistantMessage,
                        processLog: finalizeProcessLog(m.processLog ?? []),
                        processStartedAt: m.processStartedAt ?? processStartedAt,
                        processCompletedAt: completedAt,
                      }
                    : m
                ),
                updatedAt: Date.now(),
              }
            : s
        )
      );
      setStreamingAssistantId(null);

      // Refresh usage and check if pay-as-you-go was consumed
      const usageRes = await fetch("/api/ai/usage", { credentials: "include" });
      const usageData = (await usageRes.json()) as {
        used?: number;
        limit?: number | null;
        remaining?: number | null;
        tier?: string;
        payAsYouGoCount?: number;
        canQuery?: boolean;
      };
      
      if (usageRes.ok) {
        setAiUsage({
          used: usageData.used ?? 0,
          limit: usageData.limit ?? null,
          remaining: usageData.remaining ?? null,
          tier: (usageData.tier as Tier) ?? undefined,
          payAsYouGoCount: usageData.payAsYouGoCount ?? 0,
          canQuery: usageData.canQuery ?? true,
        });
        
        // Check if pay-as-you-go was consumed (count decreased from before)
        const payAsYouGoAfter = usageData.payAsYouGoCount ?? 0;
        if (payAsYouGoBefore > 0 && payAsYouGoAfter === 0) {
          setShowPayAsYouGoPrompt(true);
        }
      } else {
        // Fallback to regular fetch
        fetchAiUsage();
      }
    } catch (err) {
      const stopped =
        stopRequestedRef.current || err instanceof AiChatStoppedError;
      const isTimeoutAbort =
        !stopped && err instanceof DOMException && err.name === "AbortError";
      const id = sessionIdToUpdate;

      if (stopped) {
        const partial = streamingContentRef.current.trim();
        const stoppedContent = partial
          ? `${partial}\n\n*Response stopped.*`
          : "*Response stopped before an answer was generated.*";
        const completedAt = Date.now();
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== id) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: stoppedContent,
                      sources: filterAiResearchSourcesForDisplay(m.sources),
                      processLog: finalizeProcessLog(
                        (m.processLog ?? []).map((step) =>
                          step.status === "active" ? { ...step, status: "done" as const } : step
                        )
                      ),
                      processStartedAt: m.processStartedAt ?? processStartedAt,
                      processCompletedAt: completedAt,
                    }
                  : m
              ),
              updatedAt: Date.now(),
            };
          })
        );
        pendingAssistantScrollId = assistantId;
      } else {
        const errorMessage = isTimeoutAbort
          ? "The request timed out. Please try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.";
        const errorContent = `I apologize, but I encountered an error: ${errorMessage}. Please try again or contact support if the issue persists.`;
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== id) return s;
            const last = s.messages[s.messages.length - 1];
            if (last?.role === "assistant" && last.content === "") {
              pendingAssistantScrollId = last.id;
              const completedAt = Date.now();
              return {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === last.id
                    ? {
                        ...m,
                        content: errorContent,
                        sources: [],
                        processLog: finalizeProcessLog(m.processLog ?? []),
                        processCompletedAt: completedAt,
                      }
                    : m
                ),
                updatedAt: Date.now(),
              };
            }
            const errorResponse: Message = {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: errorContent,
              sources: [],
            };
            pendingAssistantScrollId = errorResponse.id;
            return { ...s, messages: [...s.messages, errorResponse], updatedAt: Date.now() };
          })
        );
      }
    } finally {
      chatAbortRef.current = null;
      stopRequestedRef.current = false;
      setIsLoading(false);
      setStreamingAssistantId(null);
    }

    if (pendingAssistantScrollId) {
      const sid = pendingAssistantScrollId;
      requestAnimationFrame(() => {
        requestAnimationFrame(() =>
          scrollMessageTopIntoChatPane(sid, "smooth", () => {
            historyScrollModeRef.current = "history";
          })
        );
      });
    } else {
      historyScrollModeRef.current = "history";
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hasAcknowledgedNotice) return;
    await sendMessage(input);
  };

  const submitNegativeFeedback = async () => {
    if (!negativeModal || !currentSession) return;
    setNegativeSubmitting(true);
    try {
      const conversationSnapshot = currentSession.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }));
      const res = await fetch("/api/ai/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queryLogId: negativeModal.queryLogId ?? undefined,
          relatedMessageId: negativeModal.messageId,
          rating: -1,
          issueCategory: negativeIssueCategory || undefined,
          comment: negativeIssueDetails || undefined,
          conversationSnapshot,
        }),
      });
      if (res.ok) {
        setFeedbackChoiceById((p) => ({ ...p, [negativeModal.messageId]: -1 }));
        setNegativeModal(null);
        setNegativeIssueCategory("");
        setNegativeIssueDetails("");
      }
    } finally {
      setNegativeSubmitting(false);
    }
  };

  useEffect(() => {
    if (!negativeModal) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNegativeModal(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [negativeModal]);

  const acknowledgeNotice = () => {
    if (!user) return;
    startTransition(() => {
      setHasAcknowledgedNotice(true);
    });
    const persist = () => {
      try {
        const raw = localStorage.getItem(AI_RESEARCH_NOTICE_KEY);
        const acknowledgedUsers = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
        acknowledgedUsers[user.id] = true;
        localStorage.setItem(AI_RESEARCH_NOTICE_KEY, JSON.stringify(acknowledgedUsers));
      } catch {
        // ignore
      }
    };
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(persist, { timeout: 500 });
    } else {
      setTimeout(persist, 0);
    }
  };

  if (!isLoaded && !clerkLoadTimedOut) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-[#fafaf7] px-4 dark:bg-[#0D1B2A]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8922A]" aria-hidden />
        <p className="mt-3 text-sm font-medium text-[#0D1B2A]/80 dark:text-white/80">{tLoading("aiResearch")}</p>
      </div>
    );
  }

  // Signed-out visitors see the server-rendered marketing landing below this component.
  if (!user) {
    return null;
  }

  const isSubscriptionCheckoutReturn =
    searchParams.get("checkout") === "success" && Boolean(searchParams.get("session_id")?.trim());
  if (isSubscriptionCheckoutReturn) {
    return <SubscriptionCheckoutConfirm fullPage onSynced={() => void fetchAiUsage()} />;
  }

  if (!effectiveTierLoaded || confirmingPayment || paygAccessPending || !noticeCheckDone) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#fafaf7] px-4 dark:bg-[#0D1B2A]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-[#C8922A]" />
          {(confirmingPayment || paygAccessPending) && (
            <p className="mt-2 text-sm text-[#0D1B2A]/70 dark:text-white/70">{tCommon("confirmingPayment")}</p>
          )}
          {!confirmingPayment && !paygAccessPending && !usageFetched && (
            <p className="mt-2 text-sm text-[#0D1B2A]/70 dark:text-white/70">{tLoading("yourPlan")}</p>
          )}
        </div>
      </div>
    );
  }

  // Allow free tier users if they have pay-as-you-go purchases
  if (tier === "free" && !canQuery && payAsYouGoCount === 0) {
    return <AiResearchPlanLanding />;
  }

  const planUsageLabel =
    limit === null ? `${t("unlimited")} · ${tierLabels[tier]}` : `${used} / ${limit} · ${tierLabels[tier]}`;

  function SubscriberShell() {
    const shellStyles = useAIResearchShellStyles();

    return (
    <>
      {/* AI Research: 280px sidebar + main — both follow light/dark theme */}
      <div
        className={`${shellStyles.aiShell} fixed inset-x-0 z-10 grid grid-cols-1 overflow-hidden bg-background ${
          sidebarOpen ? "md:grid-cols-[280px_minmax(0,1fr)]" : "md:grid-cols-1"
        }`}
        style={{
          top: shellTopOffset,
          height:
            shellViewportHeight != null
              ? `${Math.max(240, shellViewportHeight - shellTopOffset)}px`
              : `calc(100dvh - ${shellTopOffset}px)`,
        }}
      >
        <AiResearchSidebar
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          onNewChat={newChat}
          searchChats={searchChats}
          onSearchChatsChange={setSearchChats}
          starredSessions={starredSessions}
          recentSessions={recentSessions}
          currentId={currentId}
          onSelectChat={selectChat}
          onDeleteChat={deleteChat}
          onToggleStar={toggleChatStarred}
          tier={tier}
          planUsageLabel={planUsageLabel}
          limit={limit}
          used={used}
        />

        {sidebarOpen && (
          <div
            className="absolute inset-0 z-10 bg-black/55 md:hidden"
            aria-hidden
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className={`${shellStyles.mainPane} relative z-[1] flex min-h-0 min-w-0 flex-col overflow-hidden`}>
          <div
            className={`flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2 md:px-8 md:py-2.5 ${
              messages.length === 0
                ? `${shellStyles.headerMinimal} bg-transparent`
                : "bg-background/80 backdrop-blur-sm"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={sidebarOpen ? t("closeSidebar") : t("openSidebar")}
              >
                {!sidebarOpen ? (
                  <PanelLeft className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5 md:hidden" />
                )}
              </button>
              {messages.length > 0 ? (
                <div className="min-w-0">
                  <h2 className="heading truncate text-[14px] font-semibold tracking-tight text-foreground md:text-[15px]">
                    {t("title")}
                  </h2>
                  <p className="hidden truncate text-[11px] leading-tight text-muted-foreground sm:block">
                    {t("headerSubtitle")}
                  </p>
                  <p className="hidden text-[10px] leading-tight text-muted-foreground/90 sm:block">
                    {t("headerDisclaimer")}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {messages.length > 0 && (
                <>
                  {canShareByEmail(tier) && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setShareOpen((o) => {
                            if (!o) {
                              setChatCopied(false);
                              setEmailShareOpening(false);
                            }
                            return !o;
                          });
                        }}
                        className="flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                      >
                        <Share2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Share</span>
                      </button>
                      {shareOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            aria-hidden
                            onClick={() => setShareOpen(false)}
                          />
                          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-[6px] border border-border bg-card py-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => void handleShareEmail()}
                              disabled={emailShareOpening}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted disabled:opacity-60"
                            >
                              {emailShareOpening ? (
                                <>
                                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                                  Opening email…
                                </>
                              ) : (
                                <>
                                  <Share2 className="h-4 w-4 shrink-0 opacity-70" />
                                  Share by email
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCopyChat()}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                            >
                              {chatCopied ? (
                                <>
                                  <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                  <span className="font-medium text-emerald-700 dark:text-emerald-300">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4 shrink-0 opacity-70" />
                                  Copy chat
                                </>
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {canDownloadConversations(tier) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!currentSession?.messages.length) return;
                        setExportPreviewAt(new Date());
                        setExportPreviewOpen(true);
                      }}
                      disabled={!currentSession?.messages.length}
                      className="flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
                      aria-label="Preview and download chat as PDF"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Download PDF</span>
                    </button>
                  )}
                </>
              )}
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {tier === "free" && payAsYouGoCount > 0 ? "Limited" : tierLabels[tier]}
              </span>
            </div>
          </div>

          <div className={`${shellStyles.mainContent} flex min-h-0 flex-1 flex-col overflow-hidden`}>
            {messages.length === 0 ? (
              <div
                className={`${shellStyles.chatScroll} min-h-0 flex-1 overflow-y-auto overscroll-contain`}
              >
                <div className="mx-auto max-w-[820px] px-4 py-4 sm:px-6 md:px-8 md:py-6">
                  <AiResearchEmptyHero
                    exampleQuestions={exampleQuestions}
                    onFillPrompt={fillComposerPrompt}
                    atLimit={atLimit}
                    isTurnBusy={isTurnBusy}
                    input={input}
                    setInput={setInput}
                    onSubmit={handleSubmit}
                    onSend={(text) => {
                      void sendMessage(text);
                    }}
                    stopGenerating={stopGenerating}
                    textareaRef={composerTextareaRef}
                    mobileKeyboardInset={mobileKeyboardInset}
                    piiWarningDismissed={piiWarningDismissed}
                    onDismissPiiWarning={dismissPiiWarning}
                  />
                </div>
              </div>
            ) : (
              <>
                <div
                  ref={chatScrollRef}
                  className={`${shellStyles.chatScroll} min-h-0 flex-1 overflow-y-auto overscroll-contain`}
                >
                  <div className="mx-auto max-w-[820px] px-5 py-5 sm:px-6 md:px-8 md:py-8">
                    {!piiWarningDismissed ? (
                      <div
                        role="status"
                        className={`${shellStyles.piiBanner} mb-4 flex items-start gap-3 text-left`}
                      >
                        <p className="flex-1">{t("emptyHero.piiNotice")}</p>
                        <button
                          type="button"
                          onClick={dismissPiiWarning}
                          className="shrink-0 rounded-md px-2 py-0.5 text-[12px] font-semibold opacity-80 transition hover:opacity-100"
                          aria-label={t("emptyHero.dismissPii")}
                        >
                          {t("emptyHero.dismissPii")}
                        </button>
                      </div>
                    ) : null}
                    <div className="space-y-6">
                  {messages.map((msg, msgIdx) => {
                    const precedingUserQuery =
                      msg.role === "assistant"
                        ? [...messages.slice(0, msgIdx)].reverse().find((m) => m.role === "user")?.content ?? ""
                        : "";
                    const isAssistantTurnInProgress =
                      msg.role === "assistant" &&
                      msg.id === streamingAssistantId &&
                      msg.processCompletedAt == null;
                    const assistantContentGap =
                      msg.role === "assistant" && !isAssistantTurnInProgress
                        ? (msg.contentGap ??
                          resolveAiResearchContentGap({
                            assistantText: msg.content,
                            userQuery: precedingUserQuery,
                            effectiveCountry: msg.lawyerNudge?.country ?? null,
                            retrievedLawCount:
                              msg.retrievedLawCount ??
                              filterAiResearchSourceCardsForDisplay(msg.sourceCards).length,
                            displayedSourceCardCount:
                              filterAiResearchSourceCardsForDisplay(msg.sourceCards).length,
                            lawsUsedInAnswerCount: filterAiResearchSourceCardsForDisplay(
                              msg.sourceCards
                            ).filter((c) => c.usedInAnswer).length,
                          }))
                        : null;

                    return (
                    <div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      className={`flex items-start gap-2 sm:gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {msg.role === "assistant" ? (
                        <div
                          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E8E4DC] bg-[#0D1B2A] text-[11px] font-bold text-white dark:border-white/15 sm:flex"
                          aria-hidden
                        >
                          Y
                        </div>
                      ) : (
                        <div
                          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E8E4DC] bg-[#C8922A]/15 text-[11px] font-bold text-[#0D1B2A] dark:border-white/15 dark:bg-[#C8922A]/20 dark:text-[#F5D793] sm:flex"
                          aria-hidden
                        >
                          {user?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={user.imageUrl}
                              alt="Your profile"
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <UserCircle2 className="h-4 w-4" />
                          )}
                        </div>
                      )}
                      {msg.role === "user" ? (
                        <div className="flex min-w-0 max-w-[min(100%,560px)] flex-col items-end gap-1.5">
                          <div className="w-fit max-w-full rounded-[10px] border border-[#C8922A]/25 bg-[#FFFDF8] px-3 py-2 shadow-sm dark:border-[#C8922A]/35 dark:bg-[#243044] dark:text-white/90">
                            <p className="whitespace-pre-wrap text-[14px] leading-snug text-[#0D1B2A] dark:text-white/90">
                              {msg.content}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={isTurnBusy}
                              onClick={() => handleEditUserMessage(msg.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E8E4DC] bg-[#FAFAF7] text-[#0D1B2A]/60 transition hover:bg-white hover:text-[#0D1B2A] disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                              aria-label="Edit message"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCopyMessage(msg.id, msg.content, msg.role)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E8E4DC] bg-[#FAFAF7] text-[#0D1B2A]/60 transition hover:bg-white hover:text-[#0D1B2A] dark:border-white/15 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                              aria-label="Copy message"
                              title="Copy"
                            >
                              {copiedMessageId === msg.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                      <div className="min-w-0 max-w-[min(100%,560px)] flex-1 rounded-[10px] border border-border bg-card px-4 py-3 text-foreground shadow-sm">
                        {msg.role === "assistant" && msg.processLog && msg.processLog.length > 0 ? (
                          <AiResearchProcessPanel
                            steps={msg.processLog.map((step) => ({
                              ...step,
                              message: translateAiProcessStepMessage(step.message, t),
                              detail: step.detail
                                ? translateAiProcessStepDetail(step.detail, t)
                                : undefined,
                            }))}
                            isActive={msg.id === streamingAssistantId && msg.processCompletedAt == null}
                            startedAt={msg.processStartedAt ?? Date.now()}
                            completedAt={msg.processCompletedAt}
                          />
                        ) : null}
                        {msg.role === "assistant" && msg.content.trim() ? (
                          <div className="prose prose-sm max-w-none break-words text-foreground dark:prose-invert prose-headings:font-semibold prose-headings:text-base sm:prose-headings:text-lg prose-p:my-2 prose-p:text-[13px] sm:prose-p:text-sm prose-ul:my-2 prose-li:my-0.5 prose-strong:font-semibold prose-a:break-words prose-a:text-[#C8922A] prose-a:underline hover:prose-a:opacity-90">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                a: ({ href, children, ...props }) => (
                                  <a
                                    href={href}
                                    target={href?.startsWith("http") ? "_blank" : undefined}
                                    rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
                                    {...props}
                                  >
                                    {children}
                                  </a>
                                ),
                              }}
                            >
                              {formatAssistantAnswerForDisplay(
                                msg.content,
                                citationLookupForMessage(msg),
                                { streaming: isAssistantTurnInProgress }
                              )}
                            </ReactMarkdown>
                          </div>
                        ) : null}
                        {(() => {
                          const displaySources = filterAiResearchSourcesForDisplay(msg.sources);
                          return displaySources.length > 0 ? (
                            <p className="mt-2 border-t border-border/80 pt-2 text-[11px] text-muted-foreground">
                              Sources: {displaySources.join(" · ")}
                            </p>
                          ) : null;
                        })()}
                        {msg.webSearchNote ? (
                          <p className="mt-1 text-[11px] text-muted-foreground/90">{msg.webSearchNote}</p>
                        ) : null}
                        {(() => {
                          const displayCards = filterAiResearchSourceCardsForDisplay(msg.sourceCards);
                          if (displayCards.length === 0) return null;
                          const referenced = displayCards.filter((c) => c.usedInAnswer);
                          const other = displayCards.filter((c) => !c.usedInAnswer);
                          const renderCard = (
                            card: NonNullable<Message["sourceCards"]>[number],
                            idx: number,
                            keySuffix: string
                          ) => {
                            const isMethodology = isAiResearchMethodologySourceCard(card);
                            return (
                            <div
                              key={`${msg.id}-${card.lawId}-${keySuffix}-${idx}`}
                              className={`rounded-[8px] border p-3 ${
                                card.usedInAnswer
                                  ? "border-[#C8922A]/40 bg-[#FFFDF8]/90 dark:border-[#C8922A]/45 dark:bg-[#2D2516]/50"
                                  : "border-border bg-muted/50 dark:border-white/10 dark:bg-white/5"
                              }`}
                            >
                              <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-foreground">
                                <span>
                                  {card.docSlot ?? idx + 1}. {card.title}
                                </span>
                                {isMethodology ? (
                                  <span className="rounded-full bg-[#0D1B2A]/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0D1B2A]/70 dark:bg-white/10 dark:text-white/75">
                                    Methodology
                                  </span>
                                ) : null}
                                {card.usedInAnswer ? (
                                  <span className="rounded-full bg-[#C8922A]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8a6820] dark:bg-[#C8922A]/30 dark:text-[#F5D793]">
                                    Used in answer
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                                    {t("retrievedBadge")}
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {isMethodology ? "Yamalé Advisory" : card.country} · {card.category} · {card.status}
                              </p>
                              <p className="mt-1 text-[12px] text-foreground/70 dark:text-foreground/85">
                                &quot;{card.snippet}
                                {card.snippet.length >= 200 ? "…" : ""}&quot;
                              </p>
                              {isMethodology ? (
                                <p className="mt-2 text-[11px] text-muted-foreground">
                                  Yamalé AI Contextual Brain — reasoning framework used with library statutes (not in the
                                  public Legal Library).
                                </p>
                              ) : (
                                <Link
                                  href={`/library/${card.lawId}?returnTo=${encodeURIComponent("/ai-research")}`}
                                  className="mt-2 inline-flex text-[12px] font-semibold text-[#C8922A] hover:text-[#b88424] dark:text-[#F0C45C] dark:hover:text-[#FFD67A]"
                                >
                                  View law →
                                </Link>
                              )}
                            </div>
                            );
                          };

                          return (
                            <div className="mt-3 space-y-2 border-t border-[#E8E4DC]/80 pt-3 dark:border-white/10">
                              {referenced.length > 0 ? (
                                <>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0D1B2A]/45 dark:text-white/55">
                                    Referenced in this answer ({referenced.length})
                                  </p>
                                  <div className="space-y-2">{referenced.map((card, idx) => renderCard(card, idx, "ref"))}</div>
                                  {other.length > 0 ? (
                                    <details className="group mt-2 rounded-[8px] border border-border/60 bg-muted/20 p-2 dark:border-white/10 dark:bg-white/[0.04]">
                                      <summary className="cursor-pointer list-none text-[11px] font-medium text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                                        <span className="underline-offset-2 group-open:underline">
                                          {t("otherDocumentsRetrieved", { count: other.length })}
                                        </span>
                                      </summary>
                                      <div className="mt-2 space-y-2 border-t border-border/40 pt-2 dark:border-white/10">
                                        {other.map((card, idx) => renderCard(card, idx, "oth"))}
                                      </div>
                                    </details>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0D1B2A]/45 dark:text-white/55">
                                    {displayCards.length} document{displayCards.length !== 1 ? "s" : ""} from this search
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    The model did not tie library cards to the answer text, and unrelated retrieved
                                    instruments are hidden from this list. Open a law from /library if you need to
                                    verify wording.
                                  </p>
                                  <div className="space-y-2">{displayCards.map((card, idx) => renderCard(card, idx, "all"))}</div>
                                </>
                              )}
                            </div>
                          );
                        })()}
                        {msg.role === "assistant" && !isAssistantTurnInProgress ? (
                          <AiResearchMessageFootnotes
                            contentGap={assistantContentGap}
                            lawyerNudge={msg.lawyerNudge ?? null}
                            answerFooter={t("answerFooter")}
                          />
                        ) : null}
                        {msg.role === "assistant" && msg.citationVerification && !msg.citationVerification.allDocRefsValid ? (
                          <p className="mt-2 rounded-[6px] border border-amber-200/90 bg-amber-50/80 px-2 py-1.5 text-[11px] text-amber-900/90 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100/90">
                            This reply contains [doc:N] markers that do not match the retrieved document list. Verify sources before relying on in-text citations.
                          </p>
                        ) : null}
                        {msg.role === "assistant" && (
                          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={feedbackBusyId === msg.id || negativeSubmitting}
                              onClick={() => {
                                void (async () => {
                                  if (feedbackChoiceById[msg.id] === 1) {
                                    setFeedbackChoiceById((p) => {
                                      const next = { ...p };
                                      delete next[msg.id];
                                      return next;
                                    });
                                    return;
                                  }
                                  setFeedbackBusyId(msg.id);
                                  try {
                                    const res = await fetch("/api/ai/feedback", {
                                      method: "POST",
                                      credentials: "include",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ queryLogId: msg.queryLogId ?? undefined, relatedMessageId: msg.id, rating: 1 }),
                                    });
                                    if (res.ok) {
                                      setFeedbackChoiceById((p) => ({ ...p, [msg.id]: 1 }));
                                    }
                                  } finally {
                                    setFeedbackBusyId(null);
                                  }
                                })();
                              }}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                feedbackChoiceById[msg.id] === 1
                                  ? "border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/45 dark:bg-emerald-900/30 dark:text-emerald-200"
                                  : "border-[#E8E4DC] bg-[#FAFAF7] text-[#0D1B2A]/65 hover:bg-white hover:text-[#0D1B2A] dark:border-white/15 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                              } disabled:opacity-40`}
                              aria-label="Helpful"
                              title="Helpful"
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={feedbackBusyId === msg.id || negativeSubmitting}
                              onClick={() => {
                                if (feedbackChoiceById[msg.id] === -1) {
                                  setFeedbackChoiceById((p) => {
                                    const next = { ...p };
                                    delete next[msg.id];
                                    return next;
                                  });
                                  return;
                                }
                                setNegativeIssueCategory("");
                                setNegativeIssueDetails("");
                                setNegativeModal({ messageId: msg.id, queryLogId: msg.queryLogId ?? null });
                              }}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                feedbackChoiceById[msg.id] === -1
                                  ? "border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-500/45 dark:bg-rose-900/30 dark:text-rose-200"
                                  : "border-[#E8E4DC] bg-[#FAFAF7] text-[#0D1B2A]/65 hover:bg-white hover:text-[#0D1B2A] dark:border-white/15 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                              } disabled:opacity-40`}
                              aria-label="Not helpful"
                              title="Not helpful"
                            >
                              <ThumbsDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCopyMessage(msg.id, msg.content, msg.role)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E8E4DC] bg-[#FAFAF7] text-[#0D1B2A]/60 hover:bg-white hover:text-[#0D1B2A] dark:border-white/15 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                              aria-label="Copy response"
                              title="Copy response"
                            >
                              {copiedMessageId === msg.id ? (
                                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                    </div>
                  </div>
                </div>
                <div className="mx-auto w-full max-w-[820px] px-4 sm:px-6 md:px-8">
                  <AiResearchComposer
                    input={input}
                    setInput={setInput}
                    onSubmit={handleSubmit}
                    onSend={(text) => {
                      void sendMessage(text);
                    }}
                    isTurnBusy={isTurnBusy}
                    stopGenerating={stopGenerating}
                    atLimit={atLimit}
                    textareaRef={composerTextareaRef}
                    mobileKeyboardInset={mobileKeyboardInset}
                    variant="dock"
                    placeholder={t("describeQuestion")}
                    sendHint={t("sendHint")}
                    tapSendHint={t("tapSend")}
                    generatingHint={t("generatingHint")}
                    generatingLabel={t("generating")}
                    stopLabel={t("stopGenerating")}
                    sendLabel={t("sendMessage")}
                  />
                  {showPayAsYouGoPrompt && (
                    <div className="mt-3 rounded-[10px] border border-[#C8922A]/30 bg-[#FFFDF8] px-4 py-3 text-center dark:bg-[#2D2516]/40">
                      <p className="mb-2 text-sm font-medium text-[#0D1B2A] dark:text-white/90">
                        You have used your pay-as-you-go query.
                      </p>
                      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                        <Link
                          href="/pricing"
                          className="inline-flex items-center gap-2 rounded-[8px] bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#162436] dark:bg-[#E8B84B] dark:text-[#0D1B2A]"
                          onClick={() => setShowPayAsYouGoPrompt(false)}
                        >
                          Purchase more queries
                        </Link>
                        <Link
                          href="/pricing"
                          className="inline-flex items-center gap-2 rounded-[8px] border border-[#E8E4DC] bg-white px-4 py-2 text-sm font-medium text-[#0D1B2A] hover:bg-[#FAFAF7] dark:border-white/15 dark:bg-white/5 dark:text-white/90"
                          onClick={() => setShowPayAsYouGoPrompt(false)}
                        >
                          Upgrade plan
                        </Link>
                        <button
                          type="button"
                          onClick={() => setShowPayAsYouGoPrompt(false)}
                          className="text-xs text-[#0D1B2A]/45 hover:text-[#0D1B2A] dark:text-white/50 dark:hover:text-white/80"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                  {atLimit && !showPayAsYouGoPrompt && (
                    <p className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
                      Limit reached.{" "}
                      <Link href="/pricing" className="underline underline-offset-2 hover:no-underline">
                        Upgrade for more
                      </Link>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {negativeModal ? (
                <Dialog.Root open onOpenChange={(open) => !open && setNegativeModal(null)}>
                  <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm print:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl print:hidden focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
                      <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">
                        {t("feedback.negativeTitle")}
                      </Dialog.Title>
                      <p className="mt-4 text-sm text-muted-foreground">{t("feedback.issueTypeLabel")}</p>
                      <div className="relative mt-2">
                        <select
                          value={negativeIssueCategory}
                          onChange={(e) => setNegativeIssueCategory(e.target.value)}
                          className="w-full appearance-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-[#C8922A]/35 focus:ring-2 focus:ring-[#C8922A]/15"
                        >
                          <option value="">{t("feedback.selectPlaceholder")}</option>
                          <option value="wrong_sources">{t("feedback.issueCategories.wrong_sources")}</option>
                          <option value="missing_law_text">{t("feedback.issueCategories.missing_law_text")}</option>
                          <option value="incorrect_answer">{t("feedback.issueCategories.incorrect_answer")}</option>
                          <option value="citation_issue">{t("feedback.issueCategories.citation_issue")}</option>
                          <option value="ui_issue">{t("feedback.issueCategories.ui_issue")}</option>
                          <option value="other">{t("feedback.issueCategories.other")}</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      </div>

                      <p className="mt-5 text-sm text-muted-foreground">{t("feedback.detailsLabel")}</p>
                      <textarea
                        value={negativeIssueDetails}
                        onChange={(e) => setNegativeIssueDetails(e.target.value)}
                        rows={4}
                        placeholder={t("feedbackPlaceholder")}
                        className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[#C8922A]/35 focus:ring-2 focus:ring-[#C8922A]/15"
                      />

                      <p className="mt-4 text-sm italic text-muted-foreground">{t("feedback.submitNotice")}</p>

                      <div className="mt-6 flex flex-wrap justify-end gap-2">
                        <Dialog.Close asChild>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            {t("feedback.cancel")}
                          </button>
                        </Dialog.Close>
                        <button
                          type="button"
                          onClick={() => void submitNegativeFeedback()}
                          disabled={negativeSubmitting}
                          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          {negativeSubmitting ? t("submitting") : t("submit")}
                        </button>
                      </div>
                    </Dialog.Content>
                  </Dialog.Portal>
                </Dialog.Root>
          ) : null}
        </div>
      </div>
      {!hasAcknowledgedNotice && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0D1B2A]/45 px-4 py-6">
          <div className="flex max-h-[88dvh] w-full max-w-3xl flex-col rounded-[18px] border border-[#E8E4DC] bg-white p-4 shadow-2xl sm:p-6">
            <div className="overflow-y-auto pr-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C8922A] sm:text-[12px]">AI Legal Research</p>
              <h2 className="heading mt-2 text-xl font-semibold tracking-tight text-[#0D1B2A] sm:text-[28px] md:text-[36px]">
                Before you use AI Legal Research
              </h2>
              <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-[#1f2937] sm:mt-4 sm:text-[15px]">
                This tool searches and retrieves exclusively from Yamalé Legal Library, using Anthropic&apos;s servers,
                and does not access the internet or any external source.
              </p>
              <div className="mt-4 rounded-xl bg-[#F4F1EA] p-4 sm:mt-5 sm:p-5">
                <ul className="space-y-2 text-[14px] leading-relaxed text-[#1f2937] sm:text-[15px]">
                  <li>• Queries you submit are processed on Anthropic&apos;s servers in the United States</li>
                  <li>• Anthropic does not use your queries to train its AI models</li>
                  <li>• Responses are for reference only and are not legal advice</li>
                </ul>
              </div>
              <div className="mt-4 rounded-xl border-l-4 border-[#C8922A] bg-[#F4F1EA] p-4 sm:p-5">
                <p className="text-[14px] font-semibold text-[#674B12] sm:text-[15px]">If you are a lawyer or legal professional</p>
                <p className="mt-2 text-[14px] leading-relaxed text-[#674B12]/95 sm:text-[15px]">
                  Do not enter confidential client information, matter-specific facts, or privileged communications. Use
                  this tool for general legal research only.
                </p>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-[#0D1B2A]/55 sm:mt-5 sm:text-[14px]">
                By clicking &quot;I Acknowledge,&quot; you confirm that you have read this notice and consent to the
                processing of your query data as described in the Yamalé Privacy Policy (Version 1.0), including the
                transfer of query data to Anthropic&apos;s servers in the United States.
              </p>
            </div>
            <div className="mt-4 border-t border-[#E8E4DC] pt-4">
              <button
                type="button"
                onClick={acknowledgeNotice}
                className="inline-flex w-full items-center justify-center rounded-[10px] bg-[#0D1B2A] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#162436] sm:px-6 sm:text-[18px]"
              >
                I Acknowledge
              </button>
              <div className="mt-3 text-center">
                <Link
                  href="/privacy"
                  className="text-sm font-semibold text-[#8a6518] underline decoration-[#C8922A] underline-offset-2 hover:text-[#6e4f12] dark:text-[#e3ba65] dark:hover:text-[#f3d089] sm:text-base"
                >
                  Read our full AI data policy →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentSession && canDownloadConversations(tier) ? (
        <AIResearchChatExportPreviewDialog
          open={exportPreviewOpen}
          onOpenChange={setExportPreviewOpen}
          title={currentSession.title || "AI Legal Research"}
          messages={currentSession.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: filterAiResearchSourcesForDisplay(m.sources),
            sourceCards: filterAiResearchSourceCardsForDisplay(m.sourceCards),
          }))}
          exportedAt={exportPreviewAt ?? new Date()}
          logoUrl={platformLogoUrl}
          onDownloadPdf={handleDownloadChat}
          pdfLoading={chatPdfDownloading}
        />
      ) : null}
    </>
    );
  }

  return (
    <AIResearchShellStylesProvider>
      <SubscriberShell />
    </AIResearchShellStylesProvider>
  );
}
