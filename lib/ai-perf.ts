/**
 * Server-side timing for AI Research / RAG (Vercel logs: filter `[PERF]`).
 * Disable with AI_PERF_LOG=0.
 */

export type AiPerfTimer = {
  step: (label: string, meta?: Record<string, unknown>) => void;
  done: (meta?: Record<string, unknown>) => void;
};

export function isAiPerfLogEnabled(): boolean {
  return process.env.AI_PERF_LOG?.trim() !== "0";
}

function slugScope(scope: string, max = 56): string {
  return scope.replace(/\s+/g, " ").trim().slice(0, max) || "turn";
}

/** Cumulative + delta timing from a single turn start. */
export function createAiPerfTimer(scope: string): AiPerfTimer | null {
  if (!isAiPerfLogEnabled()) return null;

  const turn = slugScope(scope);
  const t0 = Date.now();
  let last = t0;
  const marks: Array<{ label: string; totalMs: number; deltaMs: number }> = [];

  const step = (label: string, meta?: Record<string, unknown>) => {
    const now = Date.now();
    const deltaMs = now - last;
    const totalMs = now - t0;
    last = now;
    marks.push({ label, totalMs, deltaMs });
    const extra = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    console.log(`[PERF] ${turn} ${label}: +${deltaMs}ms (total ${totalMs}ms)${extra}`);
  };

  const done = (meta?: Record<string, unknown>) => {
    const totalMs = Date.now() - t0;
    console.log(`[PERF] ${turn} TOTAL: ${totalMs}ms`, {
      marks: marks.map((m) => `${m.label}@${m.totalMs}ms(+${m.deltaMs})`),
      ...(meta ?? {}),
    });
  };

  return { step, done };
}

export function perfStep(perf: AiPerfTimer | null | undefined, label: string, meta?: Record<string, unknown>) {
  perf?.step(label, meta);
}

/** Rough input-token estimate (~4 chars/token for English legal text). */
export function estimatePromptTokensFromChars(charCount: number): number {
  return Math.round(charCount / 4);
}

export function sumLegalContextChars(
  docs: ReadonlyArray<{ content?: string | null }>
): number {
  return docs.reduce((sum, d) => sum + String(d.content ?? "").length, 0);
}
