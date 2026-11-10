"""Request and response shapes. Mirrored in web/types/api.ts; keep the two in sync."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Provider = Literal["openai", "anthropic", "ollama"]
MatchType = Literal["exact", "meaning"]


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    # The visitor's choice from the Admin page. A plain str so an unknown or
    # unavailable value falls back to the default instead of failing.
    provider: str | None = Field(default=None, max_length=20)

    model_config = {"str_strip_whitespace": True}


class Source(BaseModel):
    n: int  # the number used in the answer text: [1], [2], ...
    chunk_id: int
    document_id: str
    title: str
    page: int
    paragraph: int
    section: str | None
    content: str
    match_type: MatchType
    similarity: float


class AskResponse(BaseModel):
    answer: str
    found: bool
    sources: list[Source]
    questions_left: int
    provider: Provider
    model: str


class UsageResponse(BaseModel):
    questions_left: int
    daily_limit: int
    provider: Provider  # the site default; a visitor's own choice overrides it
    model: str
    models: dict[Provider, str]  # model name for each provider
    ollama_available: bool  # the local model can only be chosen when self-hosted


Category = Literal["policies", "contracts", "patient-materials"]


class DocumentSummary(BaseModel):
    id: str
    title: str
    category: Category
    doc_type: str
    page_count: int


class PagePassage(BaseModel):
    chunk_id: int
    paragraph: int
    section: str | None
    content: str


class DocumentPage(BaseModel):
    """GET /api/documents/{id}/pages/{page}: one page's passages in reading order."""

    document_id: str
    title: str
    category: Category
    doc_type: str
    page: int
    page_count: int
    passages: list[PagePassage]


class SearchHit(BaseModel):
    """One passage found by GET /api/search, with a one-sentence snippet to show."""

    chunk_id: int
    document_id: str
    title: str
    page: int
    section: str | None
    match_type: MatchType
    snippet: str
    highlights: list[tuple[int, int]]  # (start, end) character offsets into snippet


class SearchResponse(BaseModel):
    query: str
    results: list[SearchHit]


class AdminSummary(BaseModel):
    """GET /api/admin/summary: site-wide figures for today (the same day as the limits)."""

    questions_today: int
    # Average time until the answer starts to appear (first streamed words).
    # Only questions recorded since streaming began; None when there are none.
    avg_first_token_ms: int | None
    cost_today_usd: float
    cap_used: int
    daily_cap: int
    cap_reached: bool


class AdminQuery(BaseModel):
    id: int
    created_at: datetime
    question: str
    provider: Provider
    model: str
    first_token_ms: int | None  # until the answer started to appear; None for older rows
    latency_ms: int | None  # until the full answer was ready
    cost_usd: float


class AdminQueriesResponse(BaseModel):
    """GET /api/admin/queries: this visitor's latest questions, newest first."""

    queries: list[AdminQuery]


class LimitError(BaseModel):
    """Body of a 429 response."""

    error: Literal["visitor_limit", "daily_cap"]
    message: str
    questions_left: int = 0


class ApiError(BaseModel):
    """Body of other handled errors (e.g. 502 when the model call fails)."""

    error: str
    message: str
