"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useUser } from "@clerk/nextjs";
import {
  Send,
  Lock,
  Pencil,
  Search,
  Menu,
  Trash2,
  Share2,
  Download,
  X,
  Zap,
  Users,
  Loader2,
  ChevronDown,
  Copy,
  Check,
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
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

const STORAGE_KEY = "yamale-ai-chats";
const MAX_SESSIONS = 50;

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
    if (!trimmed || (atLimit && limit !== null)) return;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Sign in to use AI Legal Research.</p>
      </div>
    );
  }

  if (!effectiveTierLoaded || confirmingPayment) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
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
        <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/95 p-8 text-center shadow-sm shadow-primary/10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted/60">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="mt-6 text-xl font-semibold tracking-tight">AI Legal Research</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Available on Basic, Pro, and Team plans.
          </p>
          <Link
            href="/pricing"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            View plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Fixed full-viewport container below header - prevents footer from showing */}
      <div
        className="fixed left-0 right-0 top-14 z-10 flex h-[calc(100vh-3.5rem)] bg-gradient-to-b from-muted/20 via-background to-background"
        style={{ height: "calc(100vh - 3.5rem)" }}
      >
        {/* Sidebar - partial width on mobile, opaque like desktop */}
        <aside
          className={`absolute inset-y-0 left-0 z-20 flex h-full flex-col border-r border-border/70 bg-card shadow-lg transition-transform duration-200 md:relative md:z-auto md:transition-[width] ${
            sidebarOpen
              ? "translate-x-0 w-3/4 max-w-xs md:w-64 md:shrink-0"
              : "-translate-x-full w-3/4 max-w-xs md:w-0 md:shrink-0 md:overflow-hidden"
          }`}
        >
          {/* Mobile-only sidebar header - safe area top so not under status bar */}
          <div className="flex items-center justify-between border-b border-border px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:py-2 md:pt-2">
            <span className="text-sm font-semibold text-foreground">Your chats</span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close chat list"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2 p-3">
            <button
              type="button"
              onClick={newChat}
              className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-semibold text-foreground shadow-sm shadow-primary/10 transition hover:border-primary/50 hover:bg-primary/20 hover:shadow-md"
            >
              <Pencil className="h-4 w-4 text-primary" />
              New chat
            </button>
            {tier === "team" && (
              <Link
                href="/ai-research/team"
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/80"
              >
                <Users className="h-4 w-4" />
                Manage team
              </Link>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchChats}
                onChange={(e) => setSearchChats(e.target.value)}
                placeholder="Search chats"
                className="w-full rounded-xl border border-border/70 bg-background/90 py-2 pl-9 pr-3 text-sm shadow-sm outline-none ring-0 transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          <div className="flex flex-1 flex-col overflow-hidden min-h-0">
            <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your chats
            </p>
            <nav className="flex-1 overflow-y-auto px-2 pb-2">
              {filteredSessions.map((s) => (
                <div
                  key={s.id}
                  className={`group mb-1 flex items-center gap-1 rounded-xl px-2 transition ${
                    currentId === s.id
                      ? "bg-primary/15 border border-primary/30 shadow-sm"
                      : "border border-transparent hover:border-border/50 hover:bg-muted/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectChat(s.id)}
                    className={`min-w-0 flex-1 py-2.5 pl-2 text-left text-sm ${
                      currentId === s.id ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="line-clamp-2">{s.title || "New chat"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => deleteChat(s.id, e)}
                    className="shrink-0 rounded p-1.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {filteredSessions.length === 0 && (
                <p className="px-3 py-4 text-xs text-muted-foreground">
                  {searchChats.trim() ? "No matching chats." : "No chats yet."}
                </p>
              )}
            </nav>
          </div>
          <div className="border-t border-border/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
            <div className="rounded-xl border border-border/70 bg-gradient-to-br from-muted/40 to-muted/20 px-3 py-2.5 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Zap className="h-3.5 w-3.5 text-amber-500 fill-current" />
                  AI queries
                </span>
                {limit !== null ? (
                  <span className="text-xs tabular-nums font-semibold text-foreground">
                    {used} / {limit}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-primary">Unlimited</span>
                )}
              </div>
              {limit !== null && (
                <div className="h-2 w-full rounded-full bg-muted/80 overflow-hidden shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-primary/90 to-primary transition-all duration-500 shadow-sm"
                    style={{
                      width: `${Math.min(100, (used / limit) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
            <div className="text-center">
              <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-foreground">
                {TIER_LABELS[tier]} plan
              </span>
            </div>
          </div>
        </aside>

        {/* Mobile sidebar backdrop - darker for better contrast */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-10 bg-black/60 md:hidden"
            aria-hidden
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <div className="relative z-20 flex shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-card/80 px-4 py-2 backdrop-blur">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-semibold tracking-tight text-foreground">AI Legal Research</h1>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <>
                  {canShareByEmail(tier) && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShareOpen((o) => !o)}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </button>
                      {shareOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            aria-hidden
                            onClick={() => setShareOpen(false)}
                          />
                          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-card py-1 shadow-lg">
                            <button
                              type="button"
                              onClick={handleShareEmail}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                            >
                              Share by email
                            </button>
                            <button
                              type="button"
                              onClick={handleCopyChat}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
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
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  )}
                </>
              )}
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {tier === "free" && payAsYouGoCount > 0 ? "Limited" : TIER_LABELS[tier]}
              </span>
            </div>
          </div>

          {/* Messages - scrollable */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-4 py-6">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative mb-6">
                    <div
                      className="absolute -inset-4 h-24 w-24 rounded-full opacity-20 blur-xl"
                      style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
                    />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 to-primary/10">
                      <Zap className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <h2 className="heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    What can I help with?
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Ask about African law, AfCFTA, or compliance. Responses are indicative only.
                  </p>
                  <div className="mt-10 flex flex-wrap justify-center gap-3">
                    {exampleQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => sendMessage(q).catch(() => {})}
                        disabled={atLimit || isLoading}
                        className="rounded-xl border border-border/70 bg-background/80 px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/50 hover:bg-primary/10 hover:shadow-md disabled:opacity-50"
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
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                          msg.role === "user"
                            ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-primary/20"
                            : "border border-border/70 bg-card/95 backdrop-blur-sm text-foreground shadow-border/20"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:font-semibold prose-a:text-primary prose-a:underline hover:prose-a:opacity-90">
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
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {msg.content}
                          </p>
                        )}
                        {msg.sources && msg.sources.length > 0 && (
                          <p className="mt-2 text-xs opacity-80">
                            {msg.sources.join(" · ")}
                          </p>
                        )}
                        {msg.role === "assistant" && (
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => void handleCopyMessage(msg.id, msg.content)}
                              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted"
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
                    <div className="flex justify-start">
                      <div className="rounded-2xl border border-border/70 bg-card/95 backdrop-blur-sm px-4 py-3 shadow-sm">
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
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

          {/* Input bar: input, model selector, send (Claude-style) */}
          <div className="shrink-0 border-t border-border/70 bg-background/95 backdrop-blur p-4">
            <div className="mx-auto max-w-3xl">
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col rounded-2xl border border-border/70 bg-card/95 backdrop-blur-xl shadow-lg shadow-primary/10 transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="How can I help you today?"
                    disabled={atLimit}
                    className="w-full bg-transparent px-4 pt-4 pb-2 text-sm outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
                  />
                  <div className="flex items-center justify-end gap-2 px-2 pb-2 pt-0">
                    <div className="text-[11px] font-medium text-muted-foreground">
                      {activeModelName}
                    </div>
                    <button
                      type="submit"
                      disabled={!input.trim() || atLimit || isLoading}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-primary to-primary/90 p-2.5 text-primary-foreground shadow-sm shadow-primary/20 transition hover:brightness-105 disabled:opacity-50"
                      aria-label="Send"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </form>
              {showPayAsYouGoPrompt && (
                <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-center">
                  <p className="text-sm font-medium text-foreground mb-2">
                    You've used your pay-as-you-go query.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                      onClick={() => setShowPayAsYouGoPrompt(false)}
                    >
                      Purchase more queries
                    </Link>
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                      onClick={() => setShowPayAsYouGoPrompt(false)}
                    >
                      Upgrade plan
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowPayAsYouGoPrompt(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              {atLimit && !showPayAsYouGoPrompt && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
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
      {/* Spacer so page content doesn't overlap with fixed chat */}
      <div className="h-[calc(100vh-3.5rem)] shrink-0" aria-hidden />
    </>
  );
}
