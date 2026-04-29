"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useUser } from "@clerk/nextjs";
import {
  Send,
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
  AlertTriangle,
} from "lucide-react";
import { canShareByEmail, canDownloadConversations } from "@/lib/plan-limits";

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
  }>;
  lawyerNudge?: {
    country: string;
    category: string;
    count: number;
    href: string;
  } | null;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

const STORAGE_KEY = "yamale-ai-chats";
const MAX_SESSIONS = 50;
const AI_RESEARCH_NOTICE_VERSION = "v1";
const AI_RESEARCH_NOTICE_KEY = `yamale-ai-research-notice:${AI_RESEARCH_NOTICE_VERSION}`;

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

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SESSIONS) : [];
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

export default function AIResearchPage() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [searchChats, setSearchChats] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [aiUsage, setAiUsage] = useState<{
    used: number;
    limit: number | null;
    remaining: number | null;
    tier?: Tier;
    payAsYouGoCount?: number;
    canQuery?: boolean;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [showPayAsYouGoPrompt, setShowPayAsYouGoPrompt] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; display_name?: string }>>([]);
  const [defaultModelId, setDefaultModelId] = useState<string | null>(null);
  const [allowedModelIds, setAllowedModelIds] = useState<string[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [exampleQuestions, setExampleQuestions] = useState<string[]>(() => pickRandomExampleQuestions(4));
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [noticeCheckDone, setNoticeCheckDone] = useState(false);
  const [hasAcknowledgedNotice, setHasAcknowledgedNotice] = useState(false);
  const [shellTopOffset, setShellTopOffset] = useState(56);

  const tierFromMetadata: Tier =
    user?.publicMetadata ? getTierFromUser(user.publicMetadata as Record<string, unknown>) : "free";
  const tier = (aiUsage?.tier as Tier | undefined) ?? tierFromMetadata;
  const limit = aiUsage?.limit ?? TIER_LIMITS[tier];
  const currentSession = sessions.find((s) => s.id === currentId);
  const messages = currentSession?.messages ?? [];
  const used = aiUsage?.used ?? 0;
  const remaining = aiUsage?.remaining ?? (limit === null ? null : Math.max(0, limit - used));
  const payAsYouGoCount = aiUsage?.payAsYouGoCount ?? 0;
  const canQuery = aiUsage?.canQuery ?? true;
  // User is at limit only if they can't query (no plan limit remaining AND no pay-as-you-go purchases)
  const atLimit = !canQuery;
  const [usageFetched, setUsageFetched] = useState(false);
  const effectiveTierLoaded = !user || usageFetched;

  const filteredSessions = searchChats.trim()
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(searchChats.toLowerCase()) ||
          s.messages.some((m) => m.content.toLowerCase().includes(searchChats.toLowerCase()))
      )
    : sessions;

  useEffect(() => {
    if (!mounted.current) {
      setSessions(loadSessions());
      // On mobile, start with sidebar closed so chat area has full width
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setSidebarOpen(false);
      }
      mounted.current = true;
    }
  }, []);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  const fetchAiUsage = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/ai/usage", { credentials: "include" });
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
    if (!user) return;
    fetchAiUsage();
  }, [user, fetchAiUsage]);

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
        setShellTopOffset(56);
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

  const activeModelName =
    models.find((m) => m.id === (selectedModelId ?? defaultModelId ?? ""))?.display_name ??
    "Claude Sonnet (latest)";

  // Handle payment confirmation after Stripe redirect
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const payg = searchParams.get("payg");
    
    if (sessionId && payg === "ai_query" && user && !confirmingPayment) {
      setConfirmingPayment(true);
      fetch("/api/ai/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ session_id: sessionId }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Failed to confirm payment");
          }
          return data;
        })
        .then(async (data) => {
          console.log("Payment confirmed:", data);
          if (data.ok) {
            // Wait a bit for DB to be consistent, then refresh usage
            await new Promise(resolve => setTimeout(resolve, 500));
            // Refresh usage to show the purchase
            await fetchAiUsage();
            // Remove query params from URL
            window.history.replaceState({}, "", "/ai-research");
          }
        })
        .catch((err) => {
          console.error("Failed to confirm payment:", err);
          // Still try to refresh usage in case webhook already processed it
          fetchAiUsage();
        })
        .finally(() => {
          setConfirmingPayment(false);
        });
    }
  }, [searchParams, user, confirmingPayment, fetchAiUsage]);

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
          setSessions(json.sessions);
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
      .map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`)
      .join("\n\n");
  }, [currentSession]);

  const handleShareEmail = useCallback(() => {
    const body = getChatTranscript();
    const subject = encodeURIComponent(currentSession?.title || "AI Legal Research chat");
    const mailto = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setShareOpen(false);
  }, [currentSession, getChatTranscript]);

  const handleCopyChat = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getChatTranscript());
      setShareOpen(false);
    } catch {
      // ignore
    }
  }, [getChatTranscript]);

  const handleCopyMessage = useCallback(async (messageId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => {
        setCopiedMessageId((prev) => (prev === messageId ? null : prev));
      }, 1500);
    } catch {
      // ignore clipboard errors
    }
  }, []);

  const handleDownloadChat = useCallback(() => {
    const text = getChatTranscript();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentSession?.title?.slice(0, 40) || "chat"}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentSession, getChatTranscript]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || (atLimit && limit !== null) || !hasAcknowledgedNotice) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    let sessionIdToUpdate = currentId;
    if (!currentId) {
      const newSession: ChatSession = {
        id: `chat-${Date.now()}`,
        title: (trimmed.slice(0, 60) || "New chat") + (trimmed.length > 60 ? "…" : ""),
        messages: [userMessage],
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
                messages: [...s.messages, userMessage],
                title: s.messages.length === 0 ? (trimmed.slice(0, 60) || s.title) + (trimmed.length > 60 ? "…" : "") : s.title,
                updatedAt: Date.now(),
              }
            : s
        )
      );
    }
    setInput("");
    setIsLoading(true);

    try {
      // Build messages array for API (include conversation history)
      const currentSessionMessages = currentId
        ? sessions.find((s) => s.id === currentId)?.messages ?? []
        : [];
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
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: apiMessages,
          model: effectiveModelId ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error || "Failed to get AI response";
        const details = data.details;
        // Include more details in error message if available
        if (details?.error?.message) {
          throw new Error(`${errorMsg}: ${details.error.message}`);
        }
        if (details?.message) {
          throw new Error(`${errorMsg}: ${details.message}`);
        }
        throw new Error(errorMsg);
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.content || "I apologize, but I couldn't generate a response.",
        sources: data.sources || ["Claude AI · African Legal Research"],
        sourceCards: Array.isArray(data.sourceCards) ? data.sourceCards : [],
        lawyerNudge: data.lawyerNudge ?? null,
      };

      const id = sessionIdToUpdate;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, messages: [...s.messages, assistantMessage], updatedAt: Date.now() } : s
        )
      );
      
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
      const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      const errorResponse: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `I apologize, but I encountered an error: ${errorMessage}. Please try again or contact support if the issue persists.`,
        sources: [],
      };
      const id = sessionIdToUpdate;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, messages: [...s.messages, errorResponse], updatedAt: Date.now() } : s
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hasAcknowledgedNotice) return;
    await sendMessage(input);
  };

  const acknowledgeNotice = () => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(AI_RESEARCH_NOTICE_KEY);
      const acknowledgedUsers = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      acknowledgedUsers[user.id] = true;
      localStorage.setItem(AI_RESEARCH_NOTICE_KEY, JSON.stringify(acknowledgedUsers));
    } catch {
      // ignore
    }
    setHasAcknowledgedNotice(true);
  };

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Sign in to use AI Legal Research.</p>
      </div>
    );
  }

  if (!effectiveTierLoaded || confirmingPayment || !noticeCheckDone) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-primary" />
          {confirmingPayment && (
            <p className="text-sm text-muted-foreground">Confirming payment...</p>
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
      {/* Yamalé prototype — AI Research: 280px navy sidebar + cream/white main */}
      <div
        className="fixed inset-x-0 z-10 grid grid-cols-1 overflow-hidden bg-[#FAFAF7] md:grid-cols-[280px_minmax(0,1fr)]"
        style={{ top: shellTopOffset, height: `calc(100dvh - ${shellTopOffset}px)` }}
      >
        <aside
          className={`absolute inset-y-0 left-0 z-20 flex h-full min-h-0 w-[min(100%,280px)] flex-col bg-[#0D1B2A] text-white shadow-2xl transition-transform duration-200 md:relative md:z-auto md:w-[280px] md:max-w-none md:translate-x-0 md:shadow-none ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] md:hidden">
            <span className="text-[13px] font-semibold text-white/90">Research history</span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close chat list"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="border-b border-white/[0.08] px-5 py-5">
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
                className="mt-3 flex items-center justify-center gap-2 rounded-[6px] border border-white/15 px-3 py-2 text-[13px] font-medium text-white/80 transition hover:bg-white/10"
              >
                <Users className="h-4 w-4" />
                Manage team
              </Link>
            )}
          </div>
          <div className="border-b border-white/[0.08] px-5 pb-4 pt-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="text"
                value={searchChats}
                onChange={(e) => setSearchChats(e.target.value)}
                placeholder="Search previous queries…"
                className="w-full rounded-[6px] border border-white/10 bg-white/[0.07] py-2.5 pl-10 pr-3 text-[13px] text-white/80 outline-none ring-0 placeholder:text-white/35 focus:border-white/20"
              />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <p className="px-5 pb-2.5 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">Recent</p>
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
                        ? "bg-white/[0.09] font-medium text-white"
                        : "text-white/60 hover:bg-white/[0.07] hover:text-white/90"
                    }`}
                  >
                    {s.title || "New chat"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => deleteChat(s.id, e)}
                    className="shrink-0 rounded p-1.5 text-white/40 opacity-0 transition hover:bg-red-500/20 hover:text-red-200 group-hover:opacity-100"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {filteredSessions.length === 0 && (
                <p className="px-2 py-4 text-[13px] text-white/40">
                  {searchChats.trim() ? "No matching queries." : "No queries yet."}
                </p>
              )}
            </nav>
          </div>
          <div className="border-t border-white/[0.08] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-2 rounded-[6px] bg-white/[0.06] px-3 py-2.5">
              <span className="text-[12px] text-white/50">AI queries</span>
              <span className="text-right text-[12px] font-bold text-[#E8B84B]">{planUsageLabel}</span>
            </div>
            {limit !== null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
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

        <div className="relative z-[1] flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#FAFAF7]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E8E4DC] bg-[#FAFAF7] px-4 py-3 md:px-8 md:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                className="shrink-0 rounded-lg p-2 text-[#0D1B2A]/60 hover:bg-[#0D1B2A]/[0.06] hover:text-[#0D1B2A] md:hidden"
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="heading truncate text-[15px] font-semibold tracking-tight text-[#0D1B2A] md:text-base">
                  AI Legal Research
                </h1>
                <p className="hidden truncate text-[12px] text-[#0D1B2A]/45 sm:block">
                  Yamalé AI · African law and compliance
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
                        onClick={() => setShareOpen((o) => !o)}
                        className="flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[13px] text-[#0D1B2A]/55 hover:bg-[#0D1B2A]/[0.06] hover:text-[#0D1B2A]"
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
                          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-[6px] border border-[#E8E4DC] bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              onClick={handleShareEmail}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-[#FAFAF7]"
                            >
                              Share by email
                            </button>
                            <button
                              type="button"
                              onClick={handleCopyChat}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-[#FAFAF7]"
                            >
                              Copy chat
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {canDownloadConversations(tier) && (
                    <button
                      type="button"
                      onClick={handleDownloadChat}
                      className="flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[13px] text-[#0D1B2A]/55 hover:bg-[#0D1B2A]/[0.06] hover:text-[#0D1B2A]"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Download</span>
                    </button>
                  )}
                </>
              )}
              <span className="rounded-full border border-[#E8E4DC] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#0D1B2A]/50">
                {tier === "free" && payAsYouGoCount > 0 ? "Limited" : TIER_LABELS[tier]}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-2 border-b border-[#E8E4DC] bg-[#FFFDF8] px-4 py-2.5 md:px-8">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C8922A]" aria-hidden />
            <p className="text-[12px] leading-snug text-[#0D1B2A]/55">
              <span className="font-semibold text-[#0D1B2A]/70">Disclaimer:</span> Yamalé AI provides indicative
              research only. It is not legal advice. Always verify with qualified counsel before acting.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-[760px] px-4 py-8 md:px-8 md:py-10">
              {messages.length === 0 ? (
                <div className="text-center">
                  <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-[#E8E4DC] bg-white shadow-sm">
                    <Sparkles className="h-7 w-7 text-[#C8922A]" strokeWidth={1.5} aria-hidden />
                  </div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#C8922A]">Yamalé AI</p>
                  <h2 className="heading mb-3 text-[26px] font-semibold tracking-tight text-[#0D1B2A] md:text-[30px]">
                    What would you like to research?
                  </h2>
                  <p className="mx-auto mb-10 max-w-md text-[14px] leading-relaxed text-[#0D1B2A]/45">
                    Ask about African law, AfCFTA, or compliance. Responses are indicative only.
                  </p>
                  <div className="mx-auto grid max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {exampleQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => sendMessage(q).catch(() => {})}
                        disabled={atLimit || isLoading}
                        className="rounded-[6px] border border-[#E8E4DC] bg-white px-4 py-3 text-left text-[13px] leading-snug text-[#0D1B2A]/70 transition hover:border-[#C8922A]/40 hover:bg-[#FFFDF8] disabled:opacity-50"
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
                      className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {msg.role === "assistant" ? (
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E8E4DC] bg-[#0D1B2A] text-[11px] font-bold text-white"
                          aria-hidden
                        >
                          Y
                        </div>
                      ) : (
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E8E4DC] bg-[#C8922A]/15 text-[11px] font-bold text-[#0D1B2A]"
                          aria-hidden
                        >
                          You
                        </div>
                      )}
                      <div
                        className={`min-w-0 max-w-[min(100%,560px)] rounded-[10px] border px-4 py-3 shadow-sm ${
                          msg.role === "user"
                            ? "border-[#C8922A]/25 bg-[#FFFDF8] text-[#0D1B2A]"
                            : "border-[#E8E4DC] bg-white text-[#0D1B2A]"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm max-w-none text-[#0D1B2A] prose-headings:font-semibold prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:font-semibold prose-a:text-[#C8922A] prose-a:underline hover:prose-a:opacity-90">
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
                        ) : (
                          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#0D1B2A]/85">
                            {msg.content}
                          </p>
                        )}
                        {msg.sources && msg.sources.length > 0 && (
                          <p className="mt-2 border-t border-[#E8E4DC]/80 pt-2 text-[11px] text-[#0D1B2A]/45">
                            Sources: {msg.sources.join(" · ")}
                          </p>
                        )}
                        {msg.sourceCards && msg.sourceCards.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-[#E8E4DC]/80 pt-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0D1B2A]/45">
                              {msg.sourceCards.length} laws from the Yamale Legal Library
                            </p>
                            {msg.sourceCards.map((card, idx) => (
                              <div key={`${msg.id}-${card.lawId}-${idx}`} className="rounded-[8px] border border-[#E8E4DC] bg-[#FAFAF7] p-3">
                                <p className="text-[13px] font-semibold text-[#0D1B2A]">{idx + 1}. {card.title}</p>
                                <p className="mt-0.5 text-[11px] text-[#6E6357]">
                                  {card.country} · {card.category} · {card.status}
                                </p>
                                <p className="mt-1 text-[12px] text-[#0D1B2A]/70">&quot;{card.snippet}...&quot;</p>
                                <Link
                                  href={`/library/${card.lawId}?returnTo=${encodeURIComponent("/ai-research")}`}
                                  className="mt-2 inline-flex text-[12px] font-semibold text-[#C8922A] hover:text-[#b88424]"
                                >
                                  View law →
                                </Link>
                              </div>
                            ))}
                          </div>
                        )}
                        {msg.lawyerNudge && (
                          <div className="mt-3 rounded-[8px] border border-[#E8E4DC] bg-[#F9F7F2] p-3">
                            <p className="text-[12px] font-semibold text-[#0D1B2A]">
                              Need a {msg.lawyerNudge.country} {msg.lawyerNudge.category.toLowerCase()} lawyer?
                            </p>
                            <p className="mt-1 text-[12px] text-[#5D5348]">
                              {msg.lawyerNudge.count} verified lawyers in the Yamale Network specialize in this area.
                            </p>
                            <Link href={msg.lawyerNudge.href} className="mt-2 inline-flex text-[12px] font-semibold text-[#C8922A] hover:text-[#b88424]">
                              Browse lawyers →
                            </Link>
                          </div>
                        )}
                        {msg.role === "assistant" && (
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => void handleCopyMessage(msg.id, msg.content)}
                              className="inline-flex items-center gap-1 rounded-[6px] border border-[#E8E4DC] bg-[#FAFAF7] px-2 py-1 text-[11px] text-[#0D1B2A]/50 hover:bg-white hover:text-[#0D1B2A]"
                              aria-label="Copy response"
                            >
                              {copiedMessageId === msg.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E8E4DC] bg-[#0D1B2A] text-[11px] font-bold text-white"
                        aria-hidden
                      >
                        Y
                      </div>
                      <div className="rounded-[10px] border border-[#E8E4DC] bg-white px-4 py-3 shadow-sm">
                        <span className="flex items-center gap-2 text-[13px] text-[#0D1B2A]/45">
                          <Loader2 className="h-4 w-4 animate-spin text-[#C8922A]" />
                          Searching…
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-[#E8E4DC] bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8">
            <div className="mx-auto max-w-[760px]">
              <form onSubmit={handleSubmit}>
                <div className="flex items-end gap-2 rounded-[8px] border border-[#E8E4DC] bg-[#FAFAF7] p-2 shadow-inner focus-within:border-[#C8922A]/35 focus-within:ring-2 focus-within:ring-[#C8922A]/15">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (input.trim() && !atLimit && !isLoading) {
                          void sendMessage(input);
                        }
                      }
                    }}
                    placeholder="Describe your legal question…"
                    disabled={atLimit}
                    rows={2}
                    className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] text-[#0D1B2A] outline-none placeholder:text-[#0D1B2A]/35 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || atLimit || isLoading}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] bg-[#0D1B2A] text-white transition hover:bg-[#162436] disabled:opacity-40"
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-[#0D1B2A]/35">
                  {activeModelName} · Enter to send, Shift+Enter for new line
                </p>
              </form>
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
          <div className="w-full max-w-3xl overflow-y-auto rounded-[18px] border border-[#E8E4DC] bg-white p-5 shadow-2xl md:max-h-[88dvh] md:p-7">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#C8922A]">AI Legal Research</p>
            <h2 className="heading mt-2 text-[42px] font-semibold tracking-tight text-[#0D1B2A]">
              Before you use AI Legal Research
            </h2>
            <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[#0D1B2A]/78">
              This tool uses Claude, an AI developed by Anthropic (United States), to answer questions about African
              law. It searches and retrieves exclusively from the Yamale Legal Library and does not access the internet
              or any external source. All responses are drawn from African legal texts within our controlled database.
            </p>
            <div className="mt-5 rounded-xl bg-[#F4F1EA] p-5">
              <ul className="space-y-2 text-[15px] leading-relaxed text-[#0D1B2A]/78">
                <li>• Queries you submit are processed on Anthropic&apos;s servers in the United States</li>
                <li>• Anthropic does not use your queries to train its AI models</li>
                <li>• Responses are for reference only and are not legal advice</li>
              </ul>
            </div>
            <div className="mt-4 rounded-xl border-l-4 border-[#C8922A] bg-[#F4F1EA] p-5">
              <p className="text-[15px] font-semibold text-[#674B12]">If you are a lawyer or legal professional</p>
              <p className="mt-2 text-[15px] leading-relaxed text-[#674B12]/95">
                Do not enter confidential client information, matter-specific facts, or privileged communications. Use
                this tool for general legal research only.
              </p>
            </div>
            <p className="mt-5 text-[14px] leading-relaxed text-[#0D1B2A]/55">
              By clicking &quot;I Acknowledge,&quot; you confirm that you have read this notice and consent to the
              processing of your query data as described in the Yamale Privacy Policy (Version 1.0), including the
              transfer of query data to Anthropic&apos;s servers in the United States.
            </p>
            <button
              type="button"
              onClick={acknowledgeNotice}
              className="mt-5 inline-flex w-full items-center justify-center rounded-[10px] bg-[#0D1B2A] px-6 py-3 text-[18px] font-semibold text-white transition hover:bg-[#162436]"
            >
              I Acknowledge
            </button>
            <div className="mt-4 text-center">
              <Link href="/privacy" className="text-[17px] font-medium text-[#C8922A] hover:text-[#b88424]">
                Read our full AI data policy →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
