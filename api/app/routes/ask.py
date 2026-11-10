import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app import rag, usage
from app.config import PROVIDERS, VISITOR_DAILY_LIMIT
from app.db import connect
from app.llm import get_provider, model_for, ollama_available, resolve_provider
from app.models import ApiError, AskRequest, AskResponse, LimitError, UsageResponse

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


@router.post(
    "/ask",
    response_model=AskResponse,
    responses={429: {"model": LimitError}, 502: {"model": ApiError}},
)
def ask(body: AskRequest, request: Request):
    vh = usage.visitor_hash(request)

    with connect(autocommit=True) as conn:
        limit = usage.reserve(conn, vh)
        if limit:
            return JSONResponse(
                status_code=429,
                content=LimitError(error=limit, message=usage.LIMIT_MESSAGES[limit]).model_dump(),
            )

        try:
            answer = rag.answer(
                body.question, provider=resolve_provider(conn, body.provider), conn=conn
            )
        except Exception:
            log.exception("Answering failed")
            usage.refund(conn, vh)
            return JSONResponse(
                status_code=502,
                content=ApiError(
                    error="model_error",
                    message="Something went wrong while answering. Please try again.",
                ).model_dump(),
            )

        usage.log_query(conn, vh, body.question, answer)
        left = usage.questions_left(conn, vh)

    return AskResponse(
        answer=answer.text,
        found=answer.found,
        sources=answer.sources,
        questions_left=left,
        provider=answer.provider,
        model=answer.model,
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
