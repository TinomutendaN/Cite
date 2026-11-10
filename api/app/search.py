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

import re
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


def hybrid_search(
    query: str, k: int = 6, conn=None, qvec: list[float] | None = None
) -> list[SearchResult]:
    """Top k passages for the query, best first. Pass `qvec` to reuse an embedding of the query."""
    query = query.strip()
    if not query:
        return []

    params = {
        "q": query,
        "qvec": vector_literal(qvec if qvec is not None else embed([query])[0]),
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


# --- Snippets for the Documents search page -------------------------------------------
# rag.py doesn't use these. Each result gets one sentence to show, and the parts
# to highlight in it:
# - exact: the query's words (Postgres stems them, so "leaves" finds "leave"),
#   or the whole query where it appears as written ("time off", "POL-114").
# - meaning: the passage's sentence closest in meaning to the query, found by
#   embedding the sentences in one batched call and highlighted in full.

SNIPPET_MAX_WORDS = 45
MAX_SENTENCES_PER_PASSAGE = 12
_START, _STOP = "\x01", "\x02"
_SENTENCE_BREAK = re.compile(r"(?<=[.!?])\s+|\n+")

_HEADLINE_SQL = """
    SELECT id, ts_headline('english', content, websearch_to_tsquery('english', %(q)s), %(opts)s)
    FROM chunks
    WHERE id = ANY(%(ids)s)
"""
_HEADLINE_OPTS = f'HighlightAll=true, StartSel="{_START}", StopSel="{_STOP}"'

Span = tuple[int, int]


@dataclass
class Snippet:
    text: str
    highlights: list[Span]  # (start, end) character offsets into text


def _sentences(text: str) -> list[Span]:
    """Sentence spans; a newline also ends one (table passages have one row per line)."""
    spans, start = [], 0
    for m in _SENTENCE_BREAK.finditer(text):
        if text[start : m.start()].strip():
            spans.append((start, m.start()))
        start = m.end()
    if text[start:].strip():
        spans.append((start, len(text)))
    return spans or [(0, len(text))]


def _merge(spans: list[Span]) -> list[Span]:
    merged: list[Span] = []
    for s, e in sorted(spans):
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    return merged


def _unmark(marked: str) -> tuple[str, list[Span]]:
    """Strip ts_headline's markers, returning the plain text and the marked spans."""
    out, spans, start = [], [], None
    pos = 0
    for ch in marked:
        if ch == _START:
            start = pos
        elif ch == _STOP:
            if start is not None:
                spans.append((start, pos))
            start = None
        else:
            out.append(ch)
            pos += 1
    return "".join(out), spans


def _literal_spans(text: str, query: str) -> list[Span]:
    if len(query) < MIN_LIKE_LENGTH:
        return []
    return [(m.start(), m.end()) for m in re.finditer(re.escape(query), text, re.IGNORECASE)]


def _cut(text: str, sentence: Span, highlights: list[Span]) -> Snippet:
    """The sentence as a snippet: highlights moved into it, long ones trimmed around the first."""
    s, e = sentence
    inside = [(max(a, s) - s, min(b, e) - s) for a, b in highlights if a < e and b > s]
    body = text[s:e]
    # Drop leading/trailing whitespace without breaking the offsets.
    lead = len(body) - len(body.lstrip())
    body = body.strip()
    inside = [(max(0, a - lead), min(len(body), b - lead)) for a, b in inside]
    inside = [(a, b) for a, b in inside if b > a]

    words = [(m.start(), m.end()) for m in re.finditer(r"\S+", body)]
    if len(words) <= SNIPPET_MAX_WORDS:
        return Snippet(body, inside)

    first = inside[0][0] if inside else 0
    hit_word = next((i for i, (_, we) in enumerate(words) if we > first), 0)
    w0 = max(0, min(hit_word - 10, len(words) - SNIPPET_MAX_WORDS))
    w1 = w0 + SNIPPET_MAX_WORDS
    cs, ce = words[w0][0], words[w1 - 1][1]
    prefix = "… " if w0 > 0 else ""
    suffix = " …" if w1 < len(words) else ""
    shift = len(prefix) - cs
    kept = [(max(a, cs) + shift, min(b, ce) + shift) for a, b in inside if a < ce and b > cs]
    return Snippet(prefix + body[cs:ce] + suffix, kept)


def build_snippets(
    results: list[SearchResult], query: str, qvec: list[float], conn
) -> list[Snippet]:
    """One snippet per result, in the same order."""
    query = query.strip()
    snippets: dict[int, Snippet] = {}

    exact = [r for r in results if r.match_type == "exact"]
    if exact:
        rows = conn.execute(
            _HEADLINE_SQL, {"q": query, "opts": _HEADLINE_OPTS, "ids": [r.chunk_id for r in exact]}
        ).fetchall()
        marked = {cid: headline for cid, headline in rows}
        for r in exact:
            text, words = _unmark(marked.get(r.chunk_id, r.content))
            literal = _literal_spans(text, query)
            spans = _merge(words + literal)
            sentences = _sentences(text)
            # Prefer the sentence with the whole query in it, then any marked word.
            target = literal[0][0] if literal else spans[0][0] if spans else None
            sentence = next(
                (sp for sp in sentences if target is not None and sp[0] <= target < sp[1]),
                sentences[0],
            )
            snippets[r.chunk_id] = _cut(text, sentence, spans)

    meaning = [r for r in results if r.match_type == "meaning"]
    if meaning:
        per_result = [
            (r, _sentences(r.content)[:MAX_SENTENCES_PER_PASSAGE]) for r in meaning
        ]
        texts = [r.content[s:e] for r, spans in per_result for s, e in spans]
        vectors = iter(embed(texts))
        for r, spans in per_result:
            scores = [sum(a * b for a, b in zip(next(vectors), qvec)) for _ in spans]  # unit vectors
            best = spans[max(range(len(spans)), key=scores.__getitem__)]
            snippets[r.chunk_id] = _cut(r.content, best, [best])

    return [snippets[r.chunk_id] for r in results]
