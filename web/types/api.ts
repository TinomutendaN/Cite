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

/** GET /api/usage. `provider` and `model` are the answer model currently chosen on the Admin page. */
export interface UsageResponse {
  questions_left: number;
  daily_limit: number;
  provider: Provider;
  model: string;
}

/** Folder names under data/documents. */
export type Category = "policies" | "contracts" | "patient-materials";

/** GET /api/documents (a flat list, ordered by category then id). */
export interface DocumentSummary {
  id: string;
  title: string;
  category: Category;
  doc_type: string;
  page_count: number;
}

export interface PagePassage {
  chunk_id: number;
  paragraph: number;
  section: string | null;
  content: string;
}

/** GET /api/documents/{id}/pages/{page}: one page's passages in reading order. */
export interface DocumentPage {
  document_id: string;
  title: string;
  category: Category;
  doc_type: string;
  page: number;
  page_count: number;
  passages: PagePassage[];
}

/** One passage found by GET /api/search, with a one-sentence snippet to show. */
export interface SearchHit {
  chunk_id: number;
  document_id: string;
  title: string;
  page: number;
  section: string | null;
  match_type: MatchType;
  snippet: string;
  /** [start, end) character offsets into `snippet` to highlight. */
  highlights: [number, number][];
}

/** GET /api/search?q=. Not counted against the daily limit. */
export interface SearchResponse {
  query: string;
  results: SearchHit[];
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
