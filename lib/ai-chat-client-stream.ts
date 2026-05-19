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

export async function consumeAiChatSse(
  response: Response,
  handlers: {
    onStatus?: (phase: string) => void;
    onProcess?: (payload: AiProcessSsePayload) => void;
    onDelta: (text: string) => void;
  }
): Promise<AiChatDonePayload> {
  if (!response.body) {
    throw new Error("Empty response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: AiChatDonePayload | null = null;

  const handleBlock = (block: string) => {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;

    let parsed: any;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    if (event === "status" && parsed?.phase) {
      handlers.onStatus?.(String(parsed.phase));
    } else if (event === "process" && parsed?.step && parsed?.message) {
      handlers.onProcess?.({
        step: String(parsed.step),
        message: String(parsed.message),
        detail: typeof parsed.detail === "string" ? parsed.detail : undefined,
        status: parsed.status === "done" ? "done" : "active",
      });
    } else if (event === "delta" && typeof parsed?.text === "string") {
      handlers.onDelta(parsed.text);
    } else if (event === "done") {
      donePayload = parsed as AiChatDonePayload;
    } else if (event === "error") {
      const msg = String(parsed?.error ?? "Failed to get AI response");
      const details = parsed?.details;
      if (details?.error?.message) {
        throw new Error(`${msg}: ${details.error.message}`);
      }
      throw new Error(msg);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
      if (block.trim()) handleBlock(block);
    }
  }

  if (buffer.trim()) handleBlock(buffer);

  if (!donePayload) {
    throw new Error("The response ended before the assistant finished.");
  }
  return donePayload;
}

export function isAiChatSseResponse(response: Response): boolean {
  const ct = response.headers.get("content-type") ?? "";
  return ct.includes("text/event-stream");
}
