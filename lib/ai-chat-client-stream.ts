/** Parse SSE from POST /api/ai/chat (Anthropic streaming proxy). */

import type { AiProcessSsePayload } from "@/lib/ai-chat-process";

export type AiChatDonePayload = {
  content: string;
  sources: string[];
  sourceCards: unknown[];
  lawyerNudge: unknown;
  systemPromptVersion: string;
  citationVerification?: unknown;
  queryLogId: string | null;
  webSearchNote: string | null;
};

export type AiChatSseHandlers = {
  onStatus?: (phase: string) => void;
  onProcess?: (payload: AiProcessSsePayload) => void;
  onDelta: (text: string) => void;
};

/** User clicked Stop — partial streamed text may already be in the UI. */
export class AiChatStoppedError extends Error {
  constructor() {
    super("Response stopped");
    this.name = "AiChatStoppedError";
  }
}

function handleSseBlock(block: string, handlers: AiChatSseHandlers): AiChatDonePayload | null | "error_thrown" {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  const p = parsed as Record<string, unknown>;

  if (event === "status" && p?.phase) {
    handlers.onStatus?.(String(p.phase));
  } else if (event === "process" && p?.step && p?.message) {
    handlers.onProcess?.({
      step: String(p.step),
      message: String(p.message),
      detail: typeof p.detail === "string" ? p.detail : undefined,
      status: p.status === "done" ? "done" : "active",
    });
  } else if (event === "delta" && typeof p?.text === "string") {
    handlers.onDelta(p.text);
  } else if (event === "done") {
    return p as AiChatDonePayload;
  } else if (event === "error") {
    const msg = String(p?.error ?? "Failed to get AI response");
    const details = p?.details as { error?: { message?: string } } | undefined;
    if (details?.error?.message) {
      throw new Error(`${msg}: ${details.error.message}`);
    }
    throw new Error(msg);
  }
  return null;
}

function consumeSseText(text: string, handlers: AiChatSseHandlers): AiChatDonePayload {
  let donePayload: AiChatDonePayload | null = null;
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    if (!block.trim()) continue;
    try {
      const result = handleSseBlock(block, handlers);
      if (result && typeof result === "object" && "content" in result) {
        donePayload = result;
      }
    } catch (err) {
      throw err;
    }
  }
  if (!donePayload) {
    throw new Error("The response ended before the assistant finished.");
  }
  return donePayload;
}

export function looksLikeAiChatSseBody(text: string): boolean {
  const head = text.trimStart().slice(0, 32).toLowerCase();
  return head.startsWith("event:");
}

export function isAiChatSseResponse(response: Response): boolean {
  const ct = (response.headers.get("content-type") ?? "").toLowerCase();
  if (ct.includes("text/event-stream")) return true;
  if (response.headers.get("x-yamale-chat-stream") === "1") return true;
  return false;
}

export async function consumeAiChatSse(
  response: Response,
  handlers: AiChatSseHandlers,
  options?: { signal?: AbortSignal }
): Promise<AiChatDonePayload> {
  const signal = options?.signal;
  if (signal?.aborted) throw new AiChatStoppedError();

  if (!response.body) {
    const text = await response.text();
    if (looksLikeAiChatSseBody(text)) {
      return consumeSseText(text, handlers);
    }
    throw new Error("Empty response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: AiChatDonePayload | null = null;

  const onAbort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", onAbort);

  try {
  while (true) {
    if (signal?.aborted) throw new AiChatStoppedError();
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
      if (!block.trim()) continue;
      const result = handleSseBlock(block, handlers);
      if (result && typeof result === "object" && "content" in result) {
        donePayload = result;
      }
    }
  }

  if (buffer.trim()) {
    const result = handleSseBlock(buffer, handlers);
    if (result && typeof result === "object" && "content" in result) {
      donePayload = result;
    }
  }

  if (!donePayload) {
    if (signal?.aborted) throw new AiChatStoppedError();
    throw new Error("The response ended before the assistant finished.");
  }
  return donePayload;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

export type AiChatParseResult = {
  payload: AiChatDonePayload;
  /** True when the answer was streamed via SSE (deltas), not a one-shot JSON body. */
  streamed: boolean;
};

/** When Content-Type was rewritten but the body is still SSE (e.g. some proxies). */
export async function parseAiChatResponse(
  response: Response,
  handlers: AiChatSseHandlers,
  options?: { signal?: AbortSignal }
): Promise<AiChatParseResult> {
  if (isAiChatSseResponse(response)) {
    try {
      const payload = await consumeAiChatSse(response, handlers, options);
      return { payload, streamed: true };
    } catch (err) {
      if (err instanceof AiChatStoppedError) throw err;
      throw err instanceof Error ? err : new Error("Failed to get AI response");
    }
  }

  const text = await response.text();
  if (looksLikeAiChatSseBody(text)) {
    try {
      const payload = consumeSseText(text, handlers);
      return { payload, streamed: true };
    } catch (err) {
      throw err instanceof Error ? err : new Error("Failed to get AI response");
    }
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      response.ok
        ? "Server returned an unexpected response format."
        : `Failed to get AI response (${response.status}).`
    );
  }

  if (!response.ok) {
    const errorMsg = String(json.error ?? "Failed to get AI response");
    const details = json.details as { error?: { message?: string }; message?: string } | undefined;
    if (details?.error?.message) {
      throw new Error(`${errorMsg}: ${details.error.message}`);
    }
    if (details?.message) {
      throw new Error(`${errorMsg}: ${details.message}`);
    }
    throw new Error(errorMsg);
  }

  return { payload: json as AiChatDonePayload, streamed: false };
}
