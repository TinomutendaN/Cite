import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.db import connect
from app.extract import ExtractError, get_or_extract
from app.models import ApiError, ExtractRequest, ExtractResponse

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


@router.post("/extract", response_model=ExtractResponse, responses={404: {}, 502: {"model": ApiError}})
def extract(body: ExtractRequest):
    """A contract's key details: the saved result if there is one, otherwise extracted,
    saved and returned. Not a question: not counted against the daily limit."""
    try:
        with connect(autocommit=True) as conn:
            result = get_or_extract(conn, body.document_id)
    except ExtractError:
        log.exception("Extraction failed")
        return JSONResponse(
            status_code=502,
            content=ApiError(
                error="extract_error", message="Couldn't read this contract right now. Please try again."
            ).model_dump(),
        )
    if result is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    return result
