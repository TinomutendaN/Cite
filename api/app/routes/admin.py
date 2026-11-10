"""Admin page data. Reading these never counts against the free-question limit.

- /summary is site-wide for today, using the same `current_date` as the daily
  limits (UTC on Neon), so the cap card matches what `usage.reserve` checks.
- /queries is only the calling visitor's own questions (the site is public).
"""

from fastapi import APIRouter, Request

from app import usage
from app.config import DAILY_QUESTION_CAP
from app.db import connect
from app.models import AdminQueriesResponse, AdminQuery, AdminSummary

router = APIRouter(prefix="/api/admin")

RECENT_LIMIT = 20


@router.get("/summary", response_model=AdminSummary)
def summary():
    with connect() as conn:
        count, avg_ms, cost = conn.execute(
            """
            SELECT count(*), avg(first_token_ms), coalesce(sum(cost_usd), 0)
            FROM queries
            WHERE created_at >= current_date
            """
        ).fetchone()
        (cap_used,) = conn.execute(
            "SELECT coalesce(sum(count), 0) FROM usage WHERE day = current_date"
        ).fetchone()
    return AdminSummary(
        questions_today=count,
        avg_first_token_ms=round(avg_ms) if avg_ms is not None else None,
        cost_today_usd=float(cost),
        cap_used=cap_used,
        daily_cap=DAILY_QUESTION_CAP,
        cap_reached=cap_used >= DAILY_QUESTION_CAP,
    )


@router.get("/queries", response_model=AdminQueriesResponse)
def recent_queries(request: Request):
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, created_at, question, provider, model, first_token_ms, latency_ms, cost_usd
            FROM queries
            WHERE visitor_hash = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (usage.visitor_hash(request), RECENT_LIMIT),
        ).fetchall()
    return AdminQueriesResponse(
        queries=[
            AdminQuery(
                id=r[0],
                created_at=r[1],
                question=r[2],
                provider=r[3],
                model=r[4],
                first_token_ms=r[5],
                latency_ms=r[6],
                cost_usd=float(r[7]),
            )
            for r in rows
        ]
    )
