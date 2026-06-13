/** Flattened law excerpt passed into the AI system prompt and source cards. */
export type AiLegalContextDoc = {
  id: string;
  title: string;
  country: string;
  category: string;
  status?: string;
  content: string;
  year?: number;
  retrievalScore?: number;
};

export type AiLegalLibrarySearchResult = AiLegalContextDoc[];
