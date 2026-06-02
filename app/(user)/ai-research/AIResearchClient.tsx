"use client";

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  startTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  AI_RESEARCH_ENGINE_SOURCE_LABEL,
  isAiResearchMethodologySourceCard,
  normalizeAiResearchSourceLabels,
} from "@/lib/ai-research-source-cards";
import { useClientSearchParams } from "@/lib/use-client-search-params";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useUser } from "@clerk/nextjs";
import {
  Send,
  Square,
  Pencil,
  Lock,
  Plus,
  Search,
  Menu,
  Trash2,
  Share2,
  Download,
  X,
  Sparkles,
  Users,
  Loader2,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  UserCircle2,
  ChevronDown,
} from "lucide-react";
import { canShareByEmail, canDownloadConversations } from "@/lib/plan-limits";
import { plainTextForAiChatExport } from "@/lib/ai-chat-plain-text";
import { downloadAiResearchChatPdf } from "@/lib/ai-research-chat-pdf";
import { AIResearchChatExportPreviewDialog } from "@/components/ai-research/AIResearchChatExportPreviewDialog";
import { SubscriptionCheckoutConfirm } from "@/components/checkout/SubscriptionCheckoutConfirm";
import {
  clearPaygAiQueryLomiSessionIdStorage,
  readPaygAiQueryLomiSessionIdFromStorage,
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

type Tier = "free" | "basic" | "pro" | "team";

const TIER_LIMITS: Record<Tier, number | null> = {
  free: 0,
  basic: 10,
  pro: 50,
  team: null,
};

const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  team: "Team",
};

const EXAMPLE_QUESTIONS_POOL = [
  "What are the requirements for company registration in Ghana?",
  "What is the minimum wage under Kenyan employment law?",
  "What documents are needed for an AfCFTA certificate of origin?",
  "What are the rules of origin for manufactured goods under AfCFTA?",
  "How does VAT work for cross-border services in Nigeria?",
  "What are the key labour protections for employees in South Africa?",
  "What permits are required to export agricultural products under AfCFTA?",
  "How do I register a trademark in Kenya?",
  "What customs documents are needed to import machinery into Rwanda?",
  "How are AfCFTA tariff phase-down schedules applied for sensitive products?",
  "What are the main corporate tax obligations for a company in Senegal?",
  "How do rules of origin differ between AfCFTA and ECOWAS?",
];

const DEFAULT_EXAMPLE_QUESTIONS = EXAMPLE_QUESTIONS_POOL.slice(0, 4);

function pickRandomExampleQuestions(count: number): string[] {
  const pool = [...EXAMPLE_QUESTIONS_POOL];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

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
  lawyerNudge?: {
    country: string;
    category: string;
    count: number;
    href: string;
  } | null;
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
};

type NegativeFeedbackModalState = {
  messageId: string;
  queryLogId?: string | null;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

const STORAGE_KEY = "yamale-ai-chats";
const CURRENT_CHAT_ID_KEY = "yamale-ai-current-chat-id";
const MAX_SESSIONS = 50;
const AI_RESEARCH_NOTICE_VERSION = "v1";
const AI_RESEARCH_NOTICE_KEY = `yamale-ai-research-notice:${AI_RESEARCH_NOTICE_VERSION}`;
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
    messages: session.messages.map((message) =>
      message.sources?.length
        ? { ...message, sources: normalizeAiResearchSourceLabels(message.sources) }
        : message
    ),
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
  const { user, isLoaded } = useUser();
  const searchParams = useClientSearchParams();
  const chatStorageReadyRef = useRef(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
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
  /** Legacy name kept defined (some HMR/cache paths still touch it); do not use for the attempt key. */
  const paygConfirmInFlightRef = useRef(false);
  /** Do not put `confirmingPayment` in the payg effect deps — it re-runs cleanup, cancels the fetch, and `finally` used to skip clearing the UI (stuck on "Confirming payment…"). */
  const mounted = useRef(false);

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
  const [showPayAsYouGoPrompt, setShowPayAsYouGoPrompt] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; display_name?: string }>>([]);
  const [defaultModelId, setDefaultModelId] = useState<string | null>(null);
  const [allowedModelIds, setAllowedModelIds] = useState<string[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [exampleQuestions, setExampleQuestions] = useState<string[]>(DEFAULT_EXAMPLE_QUESTIONS);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [feedbackBusyId, setFeedbackBusyId] = useState<string | null>(null);
  const [feedbackChoiceById, setFeedbackChoiceById] = useState<Record<string, 1 | -1>>({});
  const [negativeModal, setNegativeModal] = useState<NegativeFeedbackModalState | null>(null);
  const [negativeIssueCategory, setNegativeIssueCategory] = useState("");
  const [negativeIssueDetails, setNegativeIssueDetails] = useState("");
  const [negativeSubmitting, setNegativeSubmitting] = useState(false);
  const [noticeCheckDone, setNoticeCheckDone] = useState(false);
  const [hasAcknowledgedNotice, setHasAcknowledgedNotice] = useState(false);
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

  useEffect(() => {
    if (!mounted.current) {
      // On mobile, start with sidebar closed so chat area has full width
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setSidebarOpen(false);
      }
      mounted.current = true;
    }
  }, []);

  useEffect(() => {
    setExampleQuestions(pickRandomExampleQuestions(4));
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
    if (!user) return;
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
      if (res.ok) {
        setAiUsage({
          used: data.used ?? 0,
          limit: data.limit ?? null,
          remaining: data.remaining ?? null,
          tier: (data.tier as Tier) ?? undefined,
          payAsYouGoCount: data.payAsYouGoCount ?? 0,
          canQuery: data.canQuery ?? true,
        });
      }
    } catch {
      // ignore
    } finally {
      setUsageFetched(true);
    }
  }, [user]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setUsageFetched(true);
      return;
    }
    setUsageFetched(false);
    void fetchAiUsage();
  }, [isLoaded, user, fetchAiUsage]);

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

  // Handle payment confirmation after PawaPay (session_id) or Lomi (cookie + from_lomi=1)
  useEffect(() => {
    const payg = searchParams.get("payg");
    const fromLomi = searchParams.get("from_lomi") === "1";
    const rawSession = searchParams.get("session_id");
    const decoded = rawSession ? decodeURIComponent(rawSession) : "";
    const isPlaceholder =
      decoded === "{CHECKOUT_SESSION_ID}" || rawSession === "{CHECKOUT_SESSION_ID}";
    const sessionIdFromUrl = rawSession && !isPlaceholder ? rawSession : null;
    const sessionIdFromStorage = fromLomi ? readPaygAiQueryLomiSessionIdFromStorage() : null;
    const sessionId = sessionIdFromUrl ?? sessionIdFromStorage;
    const useLomiCookie = fromLomi && !sessionId;
    const confirmationKey = `payg=${payg ?? ""}|sid=${sessionId ?? ""}|lomi=${useLomiCookie ? "1" : "0"}`;

    if (payg !== "ai_query" || !user) return;
    if (!sessionId && !useLomiCookie) return;
    if (paygConfirmAttemptRef.current === confirmationKey) return;
    paygConfirmAttemptRef.current = confirmationKey;

    let cancelled = false;
    setConfirmingPayment(true);
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
            await fetchAiUsage();
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
          // Avoid infinite re-confirm loops from sticky query params after a failed attempt.
          window.history.replaceState({}, "", "/ai-research");
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      } finally {
        // Always clear UI gate (see effect comment on `confirmingPayment` deps).
        setConfirmingPayment(false);
      }
    })();

    return () => {
      cancelled = true;
      setConfirmingPayment(false);
      // React Strict Mode: remount must be allowed to confirm the same return URL again.
      if (paygConfirmAttemptRef.current === confirmationKey) {
        paygConfirmAttemptRef.current = null;
      }
    };
  }, [searchParams, user, fetchAiUsage]);

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

  const getChatTranscript = useCallback(() => {
    if (!currentSession) return "";
    return currentSession.messages
      .map((m) => {
        const label = m.role === "user" ? "You" : "Yamalé AI";
        const text =
          m.role === "assistant" ? plainTextForAiChatExport(m.content) : m.content;
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
      const plain = role === "assistant" ? plainTextForAiChatExport(text) : text;
      await navigator.clipboard.writeText(plain);
      setCopiedMessageId(messageId);
      setTimeout(() => {
        setCopiedMessageId((prev) => (prev === messageId ? null : prev));
      }, 1500);
    } catch {
      // ignore clipboard errors
    }
  }, []);

  const handleDownloadChat = useCallback(async () => {
    if (!currentSession || chatPdfDownloading) return;
    setChatPdfDownloading(true);
    try {
      await downloadAiResearchChatPdf({
        title: currentSession.title || "AI Legal Research",
        messages: currentSession.messages.map((m) => ({
          role: m.role,
          content: m.content,
          sources: m.sources ? normalizeAiResearchSourceLabels(m.sources) : undefined,
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
      sources: [AI_RESEARCH_ENGINE_SOURCE_LABEL],
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
        }),
      }).finally(() => clearTimeout(chatTimeout));

      const sessionId = sessionIdToUpdate;

      const streamHandlers = {
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
        sources: normalizeAiResearchSourceLabels(
          Array.isArray(data.sources) ? data.sources : [AI_RESEARCH_ENGINE_SOURCE_LABEL]
        ),
        sourceCards: Array.isArray(data.sourceCards) ? (data.sourceCards as Message["sourceCards"]) : [],
        lawyerNudge: (data.lawyerNudge as Message["lawyerNudge"]) ?? null,
        queryLogId: typeof data.queryLogId === "string" ? data.queryLogId : null,
        citationVerification:
          data.citationVerification && typeof data.citationVerification === "object"
            ? (data.citationVerification as Message["citationVerification"])
            : undefined,
        webSearchNote: typeof data.webSearchNote === "string" ? data.webSearchNote : null,
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
                      sources: m.sources?.length
                        ? normalizeAiResearchSourceLabels(m.sources)
                        : [AI_RESEARCH_ENGINE_SOURCE_LABEL],
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
        <p className="mt-3 text-sm font-medium text-[#0D1B2A]/80 dark:text-white/80">Loading AI Research…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Sign in to use AI Legal Research.</p>
      </div>
    );
  }

  const isSubscriptionCheckoutReturn =
    searchParams.get("checkout") === "success" && Boolean(searchParams.get("session_id")?.trim());
  if (isSubscriptionCheckoutReturn) {
    return <SubscriptionCheckoutConfirm fullPage onSynced={fetchAiUsage} />;
  }

  if (!effectiveTierLoaded || confirmingPayment || !noticeCheckDone) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#fafaf7] px-4 dark:bg-[#0D1B2A]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-[#C8922A]" />
          {confirmingPayment && (
            <p className="mt-2 text-sm text-[#0D1B2A]/70 dark:text-white/70">Confirming payment…</p>
          )}
          {!confirmingPayment && !usageFetched && (
            <p className="mt-2 text-sm text-[#0D1B2A]/70 dark:text-white/70">Loading your plan…</p>
          )}
        </div>
      </div>
    );
  }

  // Allow free tier users if they have pay-as-you-go purchases
  if (tier === "free" && !canQuery && payAsYouGoCount === 0) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg shadow-[rgba(13,27,42,0.06)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h1 className="heading mt-6 text-xl font-semibold tracking-tight text-card-foreground">AI Legal Research</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Available on Basic, Pro, and Team plans.
          </p>
          <Link
            href="/pricing"
            className="mt-6 inline-flex items-center gap-2 rounded-[6px] bg-[#0D1B2A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#162436]"
          >
            View plans
          </Link>
        </div>
      </div>
    );
  }

  const planUsageLabel =
    limit === null ? `Unlimited · ${TIER_LABELS[tier]}` : `${used} / ${limit} · ${TIER_LABELS[tier]}`;

  return (
    <>
      {/* AI Research: 280px sidebar + main — both follow light/dark theme */}
      <div
        className="fixed inset-x-0 z-10 grid grid-cols-1 overflow-hidden bg-background md:grid-cols-[280px_minmax(0,1fr)]"
        style={{ top: shellTopOffset, height: `calc(100dvh - ${shellTopOffset}px)` }}
      >
        <aside
          className={`absolute inset-y-0 left-0 z-20 flex h-full min-h-0 w-[min(100%,280px)] flex-col border-r border-border bg-background text-foreground shadow-2xl transition-transform duration-200 dark:border-white/[0.08] dark:bg-[#0D1B2A] dark:text-white md:relative md:z-auto md:w-[280px] md:max-w-none md:translate-x-0 md:shadow-none ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#E8E4DC] px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] dark:border-white/[0.08] md:hidden">
            <span className="text-[13px] font-semibold text-[#0D1B2A]/90 dark:text-white/90">Research history</span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1.5 text-[#0D1B2A]/60 hover:bg-[#0D1B2A]/5 hover:text-[#0D1B2A] dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Close chat list"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="border-b border-[#E8E4DC] px-5 py-5 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                newChat();
                setSidebarOpen(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-[6px] bg-[#C8922A] px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-[#b07e22]"
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
              New research query
            </button>
            {tier === "team" && (
              <Link
                href="/ai-research/team"
                className="mt-3 flex items-center justify-center gap-2 rounded-[6px] border border-[#E8E4DC] px-3 py-2 text-[13px] font-medium text-[#0D1B2A]/80 transition hover:bg-[#0D1B2A]/5 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/10"
              >
                <Users className="h-4 w-4" />
                Manage team
              </Link>
            )}
          </div>
          <div className="border-b border-[#E8E4DC] px-5 pb-4 pt-2 dark:border-white/[0.08]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D1B2A]/35 dark:text-white/35" />
              <input
                type="text"
                value={searchChats}
                onChange={(e) => setSearchChats(e.target.value)}
                placeholder="Search previous queries…"
                className="w-full rounded-[6px] border border-[#E8E4DC] bg-white py-2.5 pl-10 pr-3 text-[13px] text-[#0D1B2A]/80 outline-none ring-0 placeholder:text-[#0D1B2A]/35 focus:border-[#C8922A]/50 dark:border-white/10 dark:bg-white/[0.07] dark:text-white/80 dark:placeholder:text-white/35 dark:focus:border-white/20"
              />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <p className="px-5 pb-2.5 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0D1B2A]/55 dark:text-white/40">
              Recent
            </p>
            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
              {filteredSessions.map((s) => (
                <div key={s.id} className="group mb-0.5 flex items-stretch gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      selectChat(s.id);
                      setSidebarOpen(false);
                    }}
                    className={`min-w-0 flex-1 truncate rounded-[6px] px-2.5 py-2 text-left text-[13px] transition ${
                      currentId === s.id
                        ? "bg-[#0D1B2A]/[0.08] font-semibold text-[#0D1B2A] dark:bg-white/[0.09] dark:text-white"
                        : "font-medium text-[#0D1B2A]/80 hover:bg-[#0D1B2A]/[0.06] hover:text-[#0D1B2A] dark:font-medium dark:text-white/80 dark:hover:bg-white/[0.07] dark:hover:text-white"
                    }`}
                  >
                    {s.title || "New chat"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => deleteChat(s.id, e)}
                    className="shrink-0 rounded p-1.5 text-[#0D1B2A]/40 opacity-0 transition hover:bg-red-500/10 hover:text-red-600 group-hover:opacity-100 dark:text-white/40 dark:hover:bg-red-500/20 dark:hover:text-red-200"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {filteredSessions.length === 0 && (
                <p className="px-2 py-4 text-[13px] font-medium text-[#0D1B2A]/60 dark:text-white/55">
                  {searchChats.trim() ? "No matching queries." : "No queries yet."}
                </p>
              )}
            </nav>
          </div>
          <div className="border-t border-[#E8E4DC] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/[0.08]">
            <div className="flex items-center justify-between gap-2 rounded-[6px] bg-[#0D1B2A]/[0.04] px-3 py-2.5 dark:bg-white/[0.06]">
              <span className="text-[12px] text-[#0D1B2A]/55 dark:text-white/50">AI queries</span>
              <span className="text-right text-[12px] font-bold text-[#9a7020] dark:text-[#E8B84B]">{planUsageLabel}</span>
            </div>
            {limit !== null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#0D1B2A]/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-[#C8922A] transition-all duration-500"
                  style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="absolute inset-0 z-10 bg-black/55 md:hidden"
            aria-hidden
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="relative z-[1] flex min-h-0 min-w-0 flex-col overflow-hidden bg-background">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 md:px-8 md:py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="heading truncate text-[14px] font-semibold tracking-tight text-foreground md:text-[15px]">
                  AI Legal Research
                </h1>
                <p className="hidden truncate text-[11px] leading-tight text-muted-foreground sm:block">
                  Yamalé AI · African law and compliance
                </p>
                <p className="hidden text-[10px] leading-tight text-muted-foreground/90 sm:block">
                  Indicative research only. Not legal advice.
                </p>
              </div>
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
                {tier === "free" && payAsYouGoCount > 0 ? "Limited" : TIER_LABELS[tier]}
              </span>
            </div>
          </div>

          <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-[760px] px-5 py-5 sm:px-6 md:px-8 md:py-10">
              {messages.length === 0 ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card shadow-sm sm:mb-6 sm:h-14 sm:w-14">
                    <Sparkles className="h-6 w-6 text-[#C8922A] sm:h-7 sm:w-7" strokeWidth={1.5} aria-hidden />
                  </div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#C8922A] sm:mb-2">Yamalé AI</p>
                  <h2 className="heading mb-2 text-xl font-semibold tracking-tight text-foreground sm:mb-3 sm:text-2xl md:text-[30px]">
                    What would you like to research?
                  </h2>
                  <p className="mx-auto mb-6 max-w-md text-[13px] leading-relaxed text-muted-foreground sm:mb-8 sm:text-[14px]">
                    Ask about African law, AfCFTA, or compliance. Responses are indicative only.
                  </p>
                  <div className="mx-auto grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
                    {exampleQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => sendMessage(q).catch(() => {})}
                        disabled={atLimit || isTurnBusy}
                        className="rounded-[6px] border border-border bg-card px-3 py-2.5 text-left text-[12px] leading-snug text-muted-foreground transition hover:border-[#C8922A]/40 hover:bg-muted disabled:opacity-50 sm:px-4 sm:py-3 sm:text-[13px]"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((msg) => (
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
                            steps={msg.processLog}
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
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : null}
                        {msg.sources && msg.sources.length > 0 && (
                          <p className="mt-2 border-t border-border/80 pt-2 text-[11px] text-muted-foreground">
                            Sources: {normalizeAiResearchSourceLabels(msg.sources).join(" · ")}
                          </p>
                        )}
                        {msg.webSearchNote ? (
                          <p className="mt-1 text-[11px] text-muted-foreground/90">{msg.webSearchNote}</p>
                        ) : null}
                        {msg.sourceCards && msg.sourceCards.length > 0 && (() => {
                          const referenced = msg.sourceCards.filter((c) => c.usedInAnswer);
                          const other = msg.sourceCards.filter((c) => !c.usedInAnswer);
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
                                    Retrieved
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
                                          Other documents retrieved this turn ({other.length})
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
                                    {msg.sourceCards.length} document{msg.sourceCards.length !== 1 ? "s" : ""} from this search
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    The model did not tie library cards to the answer text, and unrelated retrieved
                                    instruments are hidden from this list. Open a law from /library if you need to
                                    verify wording.
                                  </p>
                                  <div className="space-y-2">{msg.sourceCards.map((card, idx) => renderCard(card, idx, "all"))}</div>
                                </>
                              )}
                            </div>
                          );
                        })()}
                        {msg.lawyerNudge && (
                          <div className="mt-3 rounded-[8px] border border-[#E8E4DC] bg-[#F9F7F2] p-3 dark:border-white/10 dark:bg-white/[0.06]">
                            <p className="text-[12px] font-semibold text-[#0D1B2A] dark:text-white/90">
                              Need a {msg.lawyerNudge.country} {msg.lawyerNudge.category.toLowerCase()} lawyer?
                            </p>
                            <p className="mt-1 text-[12px] text-[#5D5348] dark:text-white/65">
                              {msg.lawyerNudge.count} verified lawyers in the Yamalé Network specialize in this area.
                            </p>
                            <Link
                              href={msg.lawyerNudge.href}
                              className="mt-2 inline-flex text-[12px] font-semibold text-[#C8922A] hover:text-[#b88424] dark:text-[#F0C45C] dark:hover:text-[#FFD67A]"
                            >
                              Browse lawyers →
                            </Link>
                          </div>
                        )}
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
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-card px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 md:px-8">
            <div className="mx-auto max-w-[760px]">
              <form onSubmit={handleSubmit}>
                <div className="flex items-end gap-2 rounded-[8px] border border-border bg-background p-1.5 shadow-inner focus-within:border-[#C8922A]/35 focus-within:ring-2 focus-within:ring-[#C8922A]/15">
                  <textarea
                    ref={composerTextareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (input.trim() && !atLimit && !isTurnBusy) {
                          void sendMessage(input);
                        }
                      }
                    }}
                    placeholder="Describe your legal question…"
                    disabled={atLimit}
                    rows={2}
                    className="min-h-[38px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
                  />
                  {isTurnBusy ? (
                    <button
                      type="button"
                      onClick={stopGenerating}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-[#0D1B2A] bg-[#0D1B2A] text-white transition hover:bg-[#162436] dark:border-white/25"
                      aria-label="Stop generating"
                      title="Stop"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim() || atLimit}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-[#0D1B2A] text-white transition hover:bg-[#162436] disabled:opacity-40"
                      aria-label="Send"
                    >
                      <Send className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                  {isTurnBusy
                    ? "Generating… Click stop to cancel"
                    : "Enter to send, Shift+Enter for new line"}
                </p>
              </form>
              {negativeModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
                  <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-[#1A1A1C] p-6 text-white shadow-2xl md:p-10">
                    <h3 className="text-2xl font-semibold">Give negative feedback</h3>
                    <p className="mt-6 text-sm text-white/70">What type of issue do you wish to report? (optional)</p>
                    <div className="relative mt-2">
                      <select
                        value={negativeIssueCategory}
                        onChange={(e) => setNegativeIssueCategory(e.target.value)}
                        className="w-full appearance-none rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-lg text-white outline-none focus:border-white/35"
                      >
                        <option value="">Select…</option>
                        <option value="wrong_sources">Wrong sources retrieved</option>
                        <option value="missing_law_text">Missing/incomplete law text</option>
                        <option value="incorrect_answer">Incorrect legal answer</option>
                        <option value="citation_issue">Citation issue</option>
                        <option value="ui_issue">UI issue</option>
                        <option value="other">Other</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/65" />
                    </div>

                    <p className="mt-8 text-sm text-white/70">Please provide details: (optional)</p>
                    <textarea
                      value={negativeIssueDetails}
                      onChange={(e) => setNegativeIssueDetails(e.target.value)}
                      rows={4}
                      placeholder="What was unsatisfying about this response?"
                      className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-lg text-white outline-none placeholder:text-white/45 focus:border-white/35"
                    />

                    <p className="mt-6 text-sm italic text-white/55">
                      Submitting this report will send the entire current conversation to the admin AI bug triage queue.
                    </p>

                    <div className="mt-8 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setNegativeModal(null)}
                        className="rounded-2xl border border-white/20 px-6 py-3 text-sm font-medium text-white/90 hover:bg-white/10"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void submitNegativeFeedback()}
                        disabled={negativeSubmitting}
                        className="rounded-2xl bg-white px-6 py-3 text-lg font-semibold text-black disabled:opacity-60"
                      >
                        {negativeSubmitting ? "Submitting…" : "Submit"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              {showPayAsYouGoPrompt && (
                <div className="mt-3 rounded-[6px] border border-[#C8922A]/30 bg-[#FFFDF8] px-4 py-3 text-center">
                  <p className="mb-2 text-sm font-medium text-[#0D1B2A]">You have used your pay-as-you-go query.</p>
                  <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-2 rounded-[6px] bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#162436]"
                      onClick={() => setShowPayAsYouGoPrompt(false)}
                    >
                      Purchase more queries
                    </Link>
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-2 rounded-[6px] border border-[#E8E4DC] bg-white px-4 py-2 text-sm font-medium text-[#0D1B2A] hover:bg-[#FAFAF7]"
                      onClick={() => setShowPayAsYouGoPrompt(false)}
                    >
                      Upgrade plan
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowPayAsYouGoPrompt(false)}
                      className="text-xs text-[#0D1B2A]/45 hover:text-[#0D1B2A]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              {atLimit && !showPayAsYouGoPrompt && (
                <p className="mt-3 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
                  Limit reached.{" "}
                  <Link href="/pricing" className="underline underline-offset-2 hover:no-underline">
                    Upgrade for more
                  </Link>
                </p>
              )}
            </div>
          </div>
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
            sources: m.sources ? normalizeAiResearchSourceLabels(m.sources) : undefined,
            sourceCards: m.sourceCards,
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
