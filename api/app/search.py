"""Hybrid search: keyword + meaning, merged with reciprocal rank fusion (RRF).

Keyword side: Postgres full-text search (websearch_to_tsquery on chunks.tsv)
plus a plain ILIKE on the passage text and document id, so codes such as
"POL-114", "BL-1042" or "[EXTERNAL]" match exactly even where the text-search
parser splits or drops them.

Meaning side: cosine distance between the question's embedding and each
passage's embedding (pgvector, HNSW index).

The keyword side gives two ranked lists (text matches, document-id matches),
the meaning side one; RRF merges all three. A result is labelled "exact" if
the keyword side found it, otherwise "meaning".
"""

from contextlib import nullcontext
from dataclasses import dataclass
from typing import Literal

from app.config import SEARCH_CANDIDATES
from app.db import connect, vector_literal
from app.llm import embed

RRF_K = 60  # standard reciprocal rank fusion constant
MIN_LIKE_LENGTH = 3  # shorter queries would match almost everything with ILIKE

MatchType = Literal["exact", "meaning"]


@dataclass
class SearchResult:
    chunk_id: int
    document_id: str
    title: str
    page: int
    paragraph: int
    section: str | None
    content: str
    similarity: float  # cosine similarity to the query, 0..1 (higher is closer)
    score: float  # RRF score used for ordering
    match_type: MatchType


_COLUMNS = """
    c.id, c.document_id, d.title, c.page, c.paragraph, c.section, c.content,
    1 - (c.embedding <=> %(qvec)s::vector) AS similarity
"""

# Text matches: full-text search, plus literal ILIKE hits (codes, phrases) first.
_TEXT_SQL = f"""
    SELECT {_COLUMNS}
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.tsv @@ websearch_to_tsquery('english', %(q)s)
       OR (%(use_like)s AND c.content ILIKE %(pat)s)
    ORDER BY
        (%(use_like)s AND c.content ILIKE %(pat)s) DESC,
        ts_rank_cd(c.tsv, websearch_to_tsquery('english', %(q)s)) DESC,
        c.id
    LIMIT %(n)s
"""

# Document-id matches ("POL-114"), in reading order. A document's own passages
# rarely contain its id (ingest strips the page headers), so this is a separate
# ranked list: its opening passages then compete fairly with text matches from
# other documents that only mention the id.
_DOC_ID_SQL = f"""
    SELECT {_COLUMNS}
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE %(use_like)s AND c.document_id ILIKE %(pat)s
    ORDER BY c.page, c.paragraph, c.document_id
    LIMIT %(n)s
"""

_MEANING_SQL = f"""
    SELECT {_COLUMNS}
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> %(qvec)s::vector
    LIMIT %(n)s
"""


def _like_pattern(query: str) -> str:
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def hybrid_search(query: str, k: int = 6, conn=None) -> list[SearchResult]:
    """Top k passages for the query, best first."""
    query = query.strip()
    if not query:
        return []

    params = {
        "q": query,
        "qvec": vector_literal(embed([query])[0]),
        "use_like": len(query) >= MIN_LIKE_LENGTH,
        "pat": _like_pattern(query),
        "n": SEARCH_CANDIDATES,
    }

    with nullcontext(conn) if conn is not None else connect() as c:
        text_rows = c.execute(_TEXT_SQL, params).fetchall()
        doc_id_rows = c.execute(_DOC_ID_SQL, params).fetchall()
        meaning_rows = c.execute(_MEANING_SQL, params).fetchall()

    rows: dict[int, tuple] = {}
    scores: dict[int, float] = {}
    keyword_ids: set[int] = set()
    for is_keyword, ranked in ((True, text_rows), (True, doc_id_rows), (False, meaning_rows)):
        for rank, row in enumerate(ranked, start=1):
            chunk_id = row[0]
            rows[chunk_id] = row
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (RRF_K + rank)
            if is_keyword:
                keyword_ids.add(chunk_id)

    best = sorted(scores, key=lambda cid: scores[cid], reverse=True)[:k]
    results = []
    for chunk_id in best:
        _, document_id, title, page, paragraph, section, content, similarity = rows[chunk_id]
        results.append(
            SearchResult(
                chunk_id=chunk_id,
                document_id=document_id,
                title=title,
                page=page,
                paragraph=paragraph,
                section=section,
                content=content,
                similarity=float(similarity),
                score=scores[chunk_id],
                match_type="exact" if chunk_id in keyword_ids else "meaning",
            )
        )
    return results
