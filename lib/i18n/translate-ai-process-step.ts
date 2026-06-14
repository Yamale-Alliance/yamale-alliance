export type AiProcessStepTranslator = (
  key: string,
  values?: Record<string, string | number | Date>
) => string;

/** Map server-side AI process step messages to `aiResearch.processSteps.*` keys. */
export function translateAiProcessStepMessage(message: string, t: AiProcessStepTranslator): string {
  const trimmed = message.trim();

  if (trimmed === "Reading your question" || trimmed === "Read your question") {
    return t("processSteps.readingQuestion");
  }
  if (trimmed === "Drafted your answer") {
    return t("processSteps.draftedAnswer");
  }
  if (/^Drafting your answer/.test(trimmed)) {
    return t("processSteps.draftingAnswer");
  }

  const retrieved = trimmed.match(/^Retrieved (\d+) instruments?$/);
  if (retrieved) {
    return t("processSteps.retrievedInstruments", { count: Number(retrieved[1]) });
  }

  const jurisdiction = trimmed.match(/^Jurisdiction:\s*(.+)$/);
  if (jurisdiction) {
    return t("processSteps.jurisdiction", { country: jurisdiction[1] });
  }

  if (/^Searching the Yamalé legal library/.test(trimmed)) {
    return t("processSteps.searchingLibrary");
  }
  if (trimmed === "No matching laws in this pass") {
    return t("processSteps.noMatchingLaws");
  }
  if (trimmed === "Product guide — no law search") {
    return t("processSteps.productGuide");
  }
  if (trimmed === "Checked supplemental web context") {
    return t("processSteps.webContext");
  }
  if (trimmed === "Searched the legal library") {
    return t("processSteps.searchedLibrary");
  }
  if (trimmed === "Processing") {
    return t("processSteps.processing");
  }

  return message;
}

export function translateAiProcessStepDetail(detail: string, t: AiProcessStepTranslator): string {
  const preStream = detail.match(/^Pre-stream (\d+)ms$/);
  if (preStream) {
    return t("processSteps.preStream", { ms: Number(preStream[1]) });
  }
  return detail;
}
