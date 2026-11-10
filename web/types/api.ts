// Shapes returned by the FastAPI backend. Mirrors api/app/models.py; keep the two in sync.

export type Provider = "openai" | "anthropic" | "ollama";

/** "exact": found by keyword search. "meaning": found only by meaning (embeddings). */
export type MatchType = "exact" | "meaning";

export interface AskRequest {
  question: string;
  /** The visitor's choice from the Admin page. The backend falls back to its default if it can't be used. */
  provider?: Provider;
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

/** The final line of POST /api/ask's stream (`type: "done"`). */
export interface AskResponse {
  answer: string;
  found: boolean;
  sources: Source[];
  questions_left: number;
  provider: Provider;
  model: string;
}

/**
 * POST /api/ask streams JSON lines: "delta" pieces of the answer as it's written
 * (citations already numbered), then one "done" with the final text and sources,
 * or one "error". A 429 (limit reached) is a plain JSON LimitError instead.
 */
export type AskStreamEvent =
  | { type: "delta"; text: string }
  | ({ type: "done" } & AskResponse)
  | ({ type: "error" } & ApiError);

/** GET /api/usage. `provider` and `model` are the site default; a visitor's own choice overrides it. */
export interface UsageResponse {
  questions_left: number;
  daily_limit: number;
  provider: Provider;
  model: string;
  /** Model name for each provider. */
  models: Record<Provider, string>;
  /** The local model can only be chosen when self-hosted. */
  ollama_available: boolean;
}

/** GET /api/admin/summary: site-wide figures for today (UTC, the same day as the limits). */
export interface AdminSummary {
  questions_today: number;
  /** Average time until the answer starts to appear. Null until a streamed answer is recorded today. */
  avg_first_token_ms: number | null;
  cost_today_usd: number;
  cap_used: number;
  daily_cap: number;
  cap_reached: boolean;
}

export interface AdminQuery {
  id: number;
  /** ISO timestamp. */
  created_at: string;
  question: string;
  provider: Provider;
  model: string;
  /** Until the answer started to appear. Null for questions recorded before streaming. */
  first_token_ms: number | null;
  /** Until the full answer was ready. */
  latency_ms: number | null;
  cost_usd: number;
}

/** GET /api/admin/queries: this visitor's latest questions, newest first. */
export interface AdminQueriesResponse {
  queries: AdminQuery[];
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

// --- Contract extraction (Extract page) ---------------------------------------------
// Every field carries the page it was found on. A value the contract doesn't state is
// null, and its page is null too.

export interface Party {
  name: string;
  /** As the contract names it, e.g. "Supplier". */
  role: string | null;
  page: number | null;
}

export interface DateField {
  /** YYYY-MM-DD, only when the contract gives an actual date. */
  value: string | null;
  /** The contract's own wording, e.g. "24 months from the Effective Date". */
  as_written: string | null;
  page: number | null;
}

export interface PaymentTerms {
  summary: string | null;
  due_days: number | null;
  late_interest: string | null;
  page: number | null;
}

export interface Renewal {
  summary: string | null;
  automatic: boolean | null;
  term_months: number | null;
  notice_days: number | null;
  page: number | null;
}

/** The saved extraction. document_id and contract (the title) are set by the server. */
export interface ContractDetails {
  document_id: string;
  contract: string;
  parties: Party[];
  start_date: DateField;
  end_date: DateField;
  payment_terms: PaymentTerms;
  renewal: Renewal;
}

/** POST /api/extract {document_id}: the saved details (extracted on first request). Not counted against the daily limit. */
export interface ExtractResponse {
  provider: Provider;
  model: string;
  /** ISO timestamp. */
  created_at: string;
  details: ContractDetails;
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
