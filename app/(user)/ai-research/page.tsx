"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  Send,
  Lock,
  Plus,
  Pencil,
  Search,
  Menu,
  Trash2,
  Share2,
  Download,
  X,
  Paperclip,
} from "lucide-react";

type Tier = "free" | "basic" | "pro" | "plus";

const TIER_LIMITS: Record<Tier, number | null> = {
  free: 0,
  basic: 10,
  pro: 50,
  plus: null,
};

const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  plus: "Plus",
};

const EXAMPLE_QUESTIONS = [
  "What are the requirements for company registration in Ghana?",
  "What is the minimum wage under Kenyan employment law?",
  "What documents are needed for AfCFTA certificate of origin?",
  "What are the rules of origin for manufactured goods under AfCFTA?",
];

const MOCK_RESPONSES = [
  "Under the Companies Act 2019 (Act 992) of Ghana, company registration requires submission of the company name, constitution, particulars of directors and secretary, and registered office address to the Registrar of Companies. The Registrar may require additional documents depending on company type. This summary is for general information only and does not constitute legal advice.",
  "The Employment Act (Cap 226) of Kenya provides for minimum wage rates set by the Labour Minister. Rates vary by sector and region. As of the latest gazette, general minimum wage applies unless a sector-specific order exists. Always verify current rates with the Ministry of Labour. This is not legal advice.",
  "AfCFTA rules of origin typically require that goods are wholly obtained or sufficiently processed in a state party. The Protocol on Rules of Origin and related guidelines specify product-specific rules and value-added thresholds. Certificate of origin must be completed using the agreed AfCFTA template. Verify with your customs authority.",
  "Commercial dispute resolution in Nigeria may involve the courts (e.g. High Court, Federal High Court) or alternative mechanisms such as arbitration under the Arbitration and Conciliation Act. Choice of forum depends on the contract and nature of the dispute. Consult a qualified legal practitioner for your situation.",
  "Legal requirements vary by jurisdiction and type of transaction. The platform provides indicative information grounded in African legal sources. For authoritative advice, consult a licensed legal professional in the relevant jurisdiction.",
];

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

function getMockResponse(_query: string): string {
  const i = Math.floor(Math.random() * MOCK_RESPONSES.length);
  return MOCK_RESPONSES[i];
}

function getTierFromUser(metadata: Record<string, unknown> | undefined): Tier {
  const t = metadata?.tier ?? metadata?.subscriptionTier;
  if (t === "pro" || t === "plus") return t;
  if (t === "team") return "plus";
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
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [searchChats, setSearchChats] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);

  const acceptFileTypes =
    "image/*,.pdf,.doc,.docx,.txt,.md,.rtf,.odt,.csv,.xls,.xlsx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const tier: Tier =
    user?.publicMetadata ? getTierFromUser(user.publicMetadata as Record<string, unknown>) : "free";
  const limit = TIER_LIMITS[tier];
  const currentSession = sessions.find((s) => s.id === currentId);
  const messages = currentSession?.messages ?? [];
  const used = sessions.reduce(
    (acc, s) => acc + s.messages.filter((m) => m.role === "user").length,
    0
  );
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const atLimit = limit !== null && (remaining ?? 0) <= 0;

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
      mounted.current = true;
    }
  }, []);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const newChat = useCallback(() => {
    setCurrentId(null);
    setInput("");
  }, []);

  const selectChat = useCallback((id: string) => {
    setCurrentId(id);
    setSidebarOpen(false);
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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setAttachedFiles((prev) => [...prev, ...Array.from(files)]);
    e.target.value = "";
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    const hasAttachments = attachedFiles.length > 0;
    const content = trimmed || (hasAttachments ? `[Attached: ${attachedFiles.map((f) => f.name).join(", ")}]` : "");
    if (!content || (atLimit && limit !== null)) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed || (hasAttachments ? `Attached ${attachedFiles.length} file(s) for context.` : ""),
    };

    let sessionIdToUpdate = currentId;
    if (!currentId) {
      const newSession: ChatSession = {
        id: `chat-${Date.now()}`,
        title: (content.slice(0, 60) || "New chat") + (content.length > 60 ? "…" : ""),
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
                title: s.messages.length === 0 ? (content.slice(0, 60) || s.title) + (content.length > 60 ? "…" : "") : s.title,
                updatedAt: Date.now(),
              }
            : s
        )
      );
    }
    setInput("");
    setAttachedFiles([]);
    setIsLoading(true);

    setTimeout(() => {
      const assistantContent = getMockResponse(content);
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: assistantContent,
        sources: ["Platform legal corpus · Indicative summary"],
      };
      const id = sessionIdToUpdate;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, messages: [...s.messages, assistantMessage], updatedAt: Date.now() } : s
        )
      );
      setIsLoading(false);
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (tier === "free") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="mt-6 text-xl font-semibold">AI Legal Research</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Available on Basic, Pro, and Plus plans.
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
        className="fixed left-0 right-0 top-14 z-10 flex h-[calc(100vh-3.5rem)] bg-background"
        style={{ height: "calc(100vh - 3.5rem)" }}
      >
        {/* Sidebar - ChatGPT style */}
        <aside
          className={`flex h-full flex-col border-r border-border bg-card/50 transition-[width] duration-200 ${
            sidebarOpen ? "w-64 shrink-0" : "w-0 shrink-0 overflow-hidden"
          }`}
        >
          <div className="flex flex-col gap-2 p-2">
            <button
              type="button"
              onClick={newChat}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/80"
            >
              <Pencil className="h-4 w-4" />
              New chat
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchChats}
                onChange={(e) => setSearchChats(e.target.value)}
                placeholder="Search chats"
                className="w-full rounded-lg border-0 bg-muted/60 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/30"
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
                  className={`group mb-0.5 flex items-center gap-1 rounded-lg px-2 transition ${
                    currentId === s.id ? "bg-muted" : "hover:bg-muted/70"
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
          <div className="border-t border-border p-3">
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-center text-xs font-medium text-muted-foreground">
              {TIER_LABELS[tier]} plan
              {limit !== null && <span className="ml-1">· {remaining} left</span>}
            </div>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-semibold text-foreground">AI Legal Research</h1>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <>
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
                  <button
                    type="button"
                    onClick={handleDownloadChat}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                </>
              )}
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {TIER_LABELS[tier]}
              </span>
            </div>
          </div>

          {/* Messages - scrollable */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-4 py-6">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <h2 className="text-2xl font-semibold text-foreground">
                    What can I help with?
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Ask about African law, AfCFTA, or compliance. Responses are indicative only.
                  </p>
                  <div className="mt-10 flex flex-wrap justify-center gap-2">
                    {EXAMPLE_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => sendMessage(q)}
                        disabled={atLimit}
                        className="rounded-full border border-border bg-transparent px-4 py-2 text-sm text-foreground hover:bg-muted/50 disabled:opacity-50"
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
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/60 text-foreground"
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {msg.content}
                        </p>
                        {msg.sources && msg.sources.length > 0 && (
                          <p className="mt-2 text-xs opacity-80">
                            {msg.sources.join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl bg-muted/60 px-4 py-3">
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

          {/* Input bar: attach files (+), input, send */}
          <div className="shrink-0 border-t border-border bg-background p-4">
            <div className="mx-auto max-w-3xl">
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptFileTypes}
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              {attachedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachedFiles.map((file, i) => (
                    <span
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="max-w-[120px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="rounded p-0.5 hover:bg-muted hover:text-foreground"
                        aria-label="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Attach files"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything. Attach images or documents with +."
                    disabled={atLimit}
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={(!input.trim() && attachedFiles.length === 0) || atLimit || isLoading}
                    className="shrink-0 rounded-lg bg-primary p-2 text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    aria-label="Send"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </form>
              {atLimit && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Limit reached. <Link href="/pricing" className="underline">Upgrade</Link> for more.
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
