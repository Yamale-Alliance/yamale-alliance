/** Live “thinking” / retrieval steps shown while AI Research runs. */

export type AiProcessStep = {
  step: string;
  message: string;
  detail?: string;
  status: "active" | "done";
  at: number;
};

export type AiProcessSsePayload = {
  step: string;
  message: string;
  detail?: string;
  status: "active" | "done";
};

export function mergeProcessStep(log: AiProcessStep[], incoming: AiProcessSsePayload): AiProcessStep[] {
  const at = Date.now();
  const idx = log.findIndex((s) => s.step === incoming.step && s.status === "active");
  const entry: AiProcessStep = {
    step: incoming.step,
    message: incoming.message,
    detail: incoming.detail,
    status: incoming.status,
    at,
  };
  if (incoming.status === "done") {
    const activeIdx = log.findIndex((s) => s.step === incoming.step && s.status === "active");
    if (activeIdx >= 0) {
      const next = [...log];
      next[activeIdx] = entry;
      return next;
    }
    const dupDone = log.findIndex(
      (s) => s.step === incoming.step && s.status === "done" && s.message === incoming.message
    );
    if (dupDone >= 0) return log;
    return [...log, entry];
  }
  if (log.some((s) => s.step === incoming.step && s.status === incoming.status && s.message === incoming.message)) {
    return log;
  }
  if (idx >= 0 && incoming.status === "active") {
    const next = [...log];
    next[idx] = entry;
    return next;
  }
  return [...log, entry];
}

/** Close out any in-flight steps when the assistant finishes (or errors). */
export function finalizeProcessLog(log: AiProcessStep[]): AiProcessStep[] {
  const now = Date.now();
  let next = log.map((s) => {
    if (s.status !== "active") return s;
    const message =
      s.step === "generating"
        ? "Drafted your answer"
        : s.step === "understand"
          ? "Read your question"
          : s.step === "library"
            ? s.message.replace(/\.\.\.|…/g, "").trim() || "Searched the legal library"
            : s.message;
    return { ...s, status: "done" as const, message, at: now };
  });
  const gen = next.find((s) => s.step === "generating");
  if (!gen) {
    next.push({ step: "generating", message: "Drafted your answer", status: "done", at: now });
  } else if (gen.status === "active" || /drafting/i.test(gen.message)) {
    next = next.map((s) =>
      s.step === "generating"
        ? { ...s, status: "done" as const, message: "Drafted your answer", at: now }
        : s
    );
  }
  return next;
}

export function summarizeProcessLog(log: AiProcessStep[], elapsedMs: number, isComplete = false): string {
  const sec = Math.max(1, Math.round(elapsedMs / 1000));
  if (log.length === 0) return isComplete ? `Worked ${sec}s` : `Working ${sec}s`;
  const doneSteps = log.filter((s) => s.status === "done");
  const tail =
    isComplete && doneSteps.length > 0
      ? doneSteps[doneSteps.length - 1]!.message
      : doneSteps.length > 0
        ? doneSteps[doneSteps.length - 1]!.message
        : (log[log.length - 1]?.message ?? "Processing");
  return isComplete ? `${sec}s · ${tail}` : `${sec}s · ${tail}`;
}
