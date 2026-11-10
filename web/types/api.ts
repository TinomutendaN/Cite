// Shapes returned by the FastAPI backend. Mirrors api/app/models.py; keep the two in sync.

export type Provider = "openai" | "anthropic" | "ollama";

/** "exact": found by keyword search. "meaning": found only by meaning (embeddings). */
export type MatchType = "exact" | "meaning";

export interface AskRequest {
  question: string;
}

/** A passage cited in an answer. `n` is the number used in the answer text: [1], [2], ... */
export interface Source {
  n: number;
  chunk_id: number;
  document_id: string;
  title: string;
  page: number;
  paragraph: number;
  section: string | null;
  content: string;
  match_type: MatchType;
  similarity: number;
}

/** POST /api/ask */
export interface AskResponse {
  answer: string;
  found: boolean;
  sources: Source[];
  questions_left: number;
  provider: Provider;
  model: string;
}

/** GET /api/usage */
export interface UsageResponse {
  questions_left: number;
  daily_limit: number;
}

/** Body of a 429 response from POST /api/ask. */
export interface LimitError {
  error: "visitor_limit" | "daily_cap";
  message: string;
  questions_left: 0;
}

/** Body of other handled errors, e.g. 502 when the model call fails. */
export interface ApiError {
  error: string;
  message: string;
}
