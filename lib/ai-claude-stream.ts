/**
 * Anthropic Messages API streaming helpers (SSE in / out).
 */

export function encodeSseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export type AnthropicStreamChunk =
  | { kind: "text_delta"; text: string }
  | { kind: "message_stop"; usage: { input_tokens: number; output_tokens: number } }
  | { kind: "error"; message: string };

/** Parse Anthropic `stream: true` SSE from a fetch Response body. */
export async function* readAnthropicMessageStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<AnthropicStreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage = { input_tokens: 0, output_tokens: 0 };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");

        let eventType = "";
        let dataLine = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) eventType = line.slice(6).trim();
          if (line.startsWith("data:")) dataLine += line.slice(5).trim();
        }
        if (!dataLine) continue;
        if (dataLine === "[DONE]") continue;

        let parsed: any;
        try {
          parsed = JSON.parse(dataLine);
        } catch {
          continue;
        }

        const type = parsed.type ?? eventType;
        if (type === "content_block_delta" && parsed.delta?.type === "text_delta") {
          const text = String(parsed.delta.text ?? "");
          if (text) yield { kind: "text_delta", text };
        } else if (type === "message_delta" && parsed.usage) {
          usage = {
            input_tokens: Number(parsed.usage.input_tokens ?? usage.input_tokens),
            output_tokens: Number(parsed.usage.output_tokens ?? usage.output_tokens),
          };
        } else if (type === "message_stop") {
          const u = parsed.message?.usage ?? parsed.usage ?? usage;
          yield {
            kind: "message_stop",
            usage: {
              input_tokens: Number(u?.input_tokens ?? 0),
              output_tokens: Number(u?.output_tokens ?? 0),
            },
          };
        } else if (type === "error") {
          yield {
            kind: "error",
            message: String(parsed.error?.message ?? parsed.message ?? "Stream error"),
          };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const AI_CHAT_SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;
