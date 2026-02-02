"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Send, MessageSquare } from "lucide-react";

type Tier = "free" | "pro" | "plus";

const TIER_LIMITS: Record<Tier, number | null> = {
  free: 5,
  pro: 50,
  plus: null, // unlimited
};

const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  plus: "Plus",
};

const EXAMPLE_QUESTIONS = [
  "What are the requirements for company registration in Ghana?",
  "What is the minimum wage under Kenyan employment law?",
  "What documents are needed for AfCFTA certificate of origin?",
  "What are the rules of origin for manufactured goods under AfCFTA?",
  "What is the process for resolving commercial disputes in Nigeria?",
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

function getMockResponse(_query: string): string {
  const i = Math.floor(Math.random() * MOCK_RESPONSES.length);
  return MOCK_RESPONSES[i];
}

function getTierFromUser(metadata: Record<string, unknown> | undefined): Tier {
  const t = metadata?.tier ?? metadata?.subscriptionTier;
  if (t === "pro" || t === "plus") return t;
  return "free";
}

export default function AIResearchPage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const tier: Tier = user?.publicMetadata ? getTierFromUser(user.publicMetadata as Record<string, unknown>) : "free";
  const limit = TIER_LIMITS[tier];
  const used = messages.filter((m) => m.role === "user").length;
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const atLimit = limit !== null && remaining <= 0;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || (atLimit && limit !== null)) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Mock delay then response
    setTimeout(() => {
      const assistantContent = getMockResponse(trimmed);
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: assistantContent,
        sources: ["Platform legal corpus · Indicative summary"],
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header with tier & usage */}
      <div className="border-b border-border bg-card/50 px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            AI-Powered Legal Research
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Natural-language queries grounded in verified African legal sources.
            Responses are indicative only and do not constitute legal advice.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
              Plan: {TIER_LABELS[tier]}
            </span>
            {limit !== null ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {used} / {limit} queries used
                </span>
                <div className="min-w-[120px] max-w-[200px] flex-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (used / limit) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                Unlimited queries (Plus)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12">
            <div className="rounded-full bg-muted p-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Ask a question about African law, AfCFTA, or cross-border compliance.
            </p>
            <p className="text-xs text-muted-foreground">
              Example questions:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  disabled={atLimit}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-left text-sm text-foreground hover:bg-accent disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <p className="mt-2 text-xs opacity-80">
                      Sources: {msg.sources.join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-border bg-card px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Searching verified sources…
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="mt-auto pt-4">
          <div className="flex gap-2 rounded-xl border border-border bg-card p-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a legal research question…"
              disabled={atLimit}
              className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || atLimit || isLoading}
              className="rounded-lg bg-primary p-2 text-primary-foreground hover:opacity-90 disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          {atLimit && (
            <p className="mt-2 text-xs text-muted-foreground">
              You&apos;ve reached your query limit for this period. Upgrade to
              Pro or Plus for more queries.
            </p>
          )}
        </form>
      </div>

      {/* Legal disclaimer */}
      <footer className="border-t border-border bg-muted/30 px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs text-muted-foreground">
            <strong>Legal disclaimer:</strong> The AI Legal Research tool
            provides indicative summaries based on the platform&apos;s indexed
            legal corpus. It does not constitute legal advice. Responses may be
            incomplete or simplified. Always verify against primary sources and
            consult a qualified legal professional for your specific situation.
            Yamalé Legal Platform is not liable for any reliance on AI-generated
            content.
          </p>
        </div>
      </footer>
    </div>
  );
}
