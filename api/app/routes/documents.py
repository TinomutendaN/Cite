import logging
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.db import connect
from app.llm import embed
from app.models import ApiError, DocumentPage, DocumentSummary, PagePassage, SearchHit, SearchResponse
from app.search import build_snippets, hybrid_search

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

SEARCH_RESULTS = 8


@router.get("/search", response_model=SearchResponse, responses={502: {"model": ApiError}})
def search(q: Annotated[str, Query(min_length=1, max_length=200)]):
    """Hybrid search for the Documents page. Not a question: it isn't counted against
    the daily limit and isn't written to the queries log."""
    query = q.strip()
    if not query:
        return SearchResponse(query=q, results=[])
    try:
        qvec = embed([query])[0]
        with connect() as conn:
            results = hybrid_search(query, SEARCH_RESULTS, conn=conn, qvec=qvec)
            snippets = build_snippets(results, query, qvec, conn)
    except Exception:
        log.exception("Search failed")
        return JSONResponse(
            status_code=502,
            content=ApiError(
                error="search_error", message="Search isn't working right now. Please try again."
            ).model_dump(),
        )

    return SearchResponse(
        query=query,
        results=[
            SearchHit(
                chunk_id=r.chunk_id,
                document_id=r.document_id,
                title=r.title,
                page=r.page,
                section=r.section,
                match_type=r.match_type,
                snippet=s.text,
                highlights=s.highlights,
            )
            for r, s in zip(results, snippets)
        ],
    )


@router.get("/documents", response_model=list[DocumentSummary])
def list_documents():
    """Every sample document, ordered by category then id. The frontend groups them."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, title, category, doc_type, page_count FROM documents ORDER BY category, id"
        ).fetchall()
    return [
        DocumentSummary(id=r[0], title=r[1], category=r[2], doc_type=r[3], page_count=r[4])
        for r in rows
    ]


@router.get("/documents/{document_id}/pages/{page}", response_model=DocumentPage)
def get_page(document_id: str, page: int):
    """One page's passages in reading order, so a cited passage can be shown in context."""
    with connect() as conn:
        doc = conn.execute(
            "SELECT id, title, category, doc_type, page_count FROM documents WHERE id = %s",
            (document_id,),
        ).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        if not 1 <= page <= doc[4]:
            raise HTTPException(status_code=404, detail="Page not found")
        rows = conn.execute(
            """
            SELECT id, paragraph, section, content
            FROM chunks
            WHERE document_id = %s AND page = %s
            ORDER BY paragraph, id
            """,
            (document_id, page),
        ).fetchall()

    return DocumentPage(
        document_id=doc[0],
        title=doc[1],
        category=doc[2],
        doc_type=doc[3],
        page=page,
        page_count=doc[4],
        passages=[
            PagePassage(chunk_id=r[0], paragraph=r[1], section=r[2], content=r[3]) for r in rows
        ],
    )
