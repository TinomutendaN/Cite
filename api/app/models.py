"""Request and response shapes. Mirrored in web/types/api.ts; keep the two in sync."""

from typing import Literal

from pydantic import BaseModel, Field

Provider = Literal["openai", "anthropic", "ollama"]
MatchType = Literal["exact", "meaning"]


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)

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
    provider: Provider  # the answer model currently chosen on the Admin page
    model: str


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


class LimitError(BaseModel):
    """Body of a 429 response."""

    error: Literal["visitor_limit", "daily_cap"]
    message: str
    questions_left: int = 0


class ApiError(BaseModel):
    """Body of other handled errors (e.g. 502 when the model call fails)."""

    error: str
    message: str
