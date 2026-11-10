from fastapi import APIRouter, HTTPException

from app.db import connect
from app.models import DocumentPage, DocumentSummary, PagePassage

router = APIRouter(prefix="/api")


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
