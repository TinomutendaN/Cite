import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app import rag, usage
from app.config import PROVIDERS, VISITOR_DAILY_LIMIT
from app.db import connect
from app.llm import get_provider, model_for, ollama_available, resolve_provider
from app.models import ApiError, AskRequest, AskResponse, LimitError, UsageResponse

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


def _line(event: dict) -> bytes:
    return (json.dumps(event) + "\n").encode()


@router.post(
    "/ask",
    responses={
        200: {"content": {"application/x-ndjson": {}}, "description": "Streamed answer as JSON lines (see below)"},
        429: {"model": LimitError},
    },
)
def ask(body: AskRequest, request: Request):
    """Answer a question as a stream of JSON lines (NDJSON).

    Lines: {"type": "delta", "text": ...} while the answer is written, then one
    {"type": "done", ...AskResponse} with the final text and sources, or one
    {"type": "error", ...ApiError} if answering failed (the question is refunded).
    Limits are checked first, so a 429 is still a plain JSON response.
    """
    vh = usage.visitor_hash(request)

    with connect(autocommit=True) as conn:
        limit = usage.reserve(conn, vh)
        if limit:
            return JSONResponse(
                status_code=429,
                content=LimitError(error=limit, message=usage.LIMIT_MESSAGES[limit]).model_dump(),
            )
        provider = resolve_provider(conn, body.provider)

    def events():
        # A fresh connection: this runs after the route has returned.
        with connect(autocommit=True) as conn:
            try:
                stream = rag.answer_stream(body.question, provider=provider, conn=conn)
                while True:
                    try:
                        text = next(stream)
                    except StopIteration as stop:
                        answer = stop.value
                        break
                    yield _line({"type": "delta", "text": text})
            except Exception:
                log.exception("Answering failed")
                usage.refund(conn, vh)
                yield _line(
                    {
                        "type": "error",
                        **ApiError(
                            error="model_error",
                            message="Something went wrong while answering. Please try again.",
                        ).model_dump(),
                    }
                )
                return

            usage.log_query(conn, vh, body.question, answer)
            done = AskResponse(
                answer=answer.text,
                found=answer.found,
                sources=answer.sources,
                questions_left=usage.questions_left(conn, vh),
                provider=answer.provider,
                model=answer.model,
            )
            yield _line({"type": "done", **done.model_dump()})

    return StreamingResponse(
        events(),
        media_type="application/x-ndjson",
        # Ask proxies not to hold the stream back.
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@router.get("/usage", response_model=UsageResponse)
def get_usage(request: Request):
    with connect(autocommit=True) as conn:
        left = usage.questions_left(conn, usage.visitor_hash(request))
        provider = get_provider(conn)
    return UsageResponse(
        questions_left=left,
        daily_limit=VISITOR_DAILY_LIMIT,
        provider=provider,
        model=model_for(provider),
        models={p: model_for(p) for p in PROVIDERS},
        ollama_available=ollama_available(),
    )
