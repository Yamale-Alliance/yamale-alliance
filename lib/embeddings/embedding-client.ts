/**
 * Query/law text embeddings for hybrid RAG.
 * Supports Voyage (voyage-law-2, 1024 dims) and OpenAI (text-embedding-3-small, 1536 dims).
 */

export const DEFAULT_EMBEDDING_MODEL = "voyage-law-2";
export const VOYAGE_LAW2_DIMENSIONS = 1024;
export const OPENAI_SMALL_DIMENSIONS = 1536;

export type EmbeddingProvider = "voyage" | "openai";

export function embeddingProviderFromEnv(): EmbeddingProvider | null {
  if (process.env.VOYAGE_API_KEY?.trim()) return "voyage";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return null;
}

export function embeddingModelFromEnv(): string {
  return process.env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
}

export function embeddingDimensionsForModel(model: string): number {
  if (model.startsWith("text-embedding-3")) return OPENAI_SMALL_DIMENSIONS;
  return VOYAGE_LAW2_DIMENSIONS;
}

export function isAiEmbeddingsEnabled(): boolean {
  if (process.env.AI_EMBEDDINGS_ENABLED === "0") return false;
  if (process.env.AI_EMBEDDINGS_ENABLED === "1") return embeddingProviderFromEnv() != null;
  return embeddingProviderFromEnv() != null;
}

async function embedWithVoyage(texts: string[], model: string): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY?.trim();
  if (!apiKey) throw new Error("VOYAGE_API_KEY is not set");

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model,
      input_type: "query",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Voyage embeddings failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const vectors = (json.data ?? []).map((row) => row.embedding ?? []);
  if (vectors.length !== texts.length || vectors.some((v) => v.length === 0)) {
    throw new Error("Voyage embeddings returned an unexpected shape");
  }
  return vectors;
}

async function embedWithOpenAI(texts: string[], model: string): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const vectors = (json.data ?? []).map((row) => row.embedding ?? []);
  if (vectors.length !== texts.length || vectors.some((v) => v.length === 0)) {
    throw new Error("OpenAI embeddings returned an unexpected shape");
  }
  return vectors;
}

/** Embed one or more texts for storage or query search. */
export async function embedTexts(
  texts: string[],
  options?: { model?: string; inputType?: "query" | "document" }
): Promise<number[][]> {
  const cleaned = texts.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (cleaned.length === 0) return [];

  const provider = embeddingProviderFromEnv();
  if (!provider) throw new Error("No embedding provider configured (VOYAGE_API_KEY or OPENAI_API_KEY)");

  const model = options?.model ?? embeddingModelFromEnv();
  if (provider === "openai") {
    return embedWithOpenAI(cleaned, model.startsWith("text-embedding") ? model : "text-embedding-3-small");
  }

  const voyageModel = model.includes("voyage") ? model : DEFAULT_EMBEDDING_MODEL;
  if (options?.inputType === "document") {
    const apiKey = process.env.VOYAGE_API_KEY?.trim();
    if (!apiKey) throw new Error("VOYAGE_API_KEY is not set");
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: cleaned,
        model: voyageModel,
        input_type: "document",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Voyage document embeddings failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    return (json.data ?? []).map((row) => row.embedding ?? []);
  }

  return embedWithVoyage(cleaned, voyageModel);
}

export async function embedQueryText(query: string): Promise<number[] | null> {
  if (!isAiEmbeddingsEnabled()) return null;
  const text = query.replace(/\s+/g, " ").trim();
  if (!text) return null;
  try {
    const [vector] = await embedTexts([text], { inputType: "query" });
    return vector ?? null;
  } catch (err) {
    console.warn("[embeddings] query embed failed:", err);
    return null;
  }
}
