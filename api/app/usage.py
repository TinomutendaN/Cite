"""Daily limits and the query log.

Everything lives in Postgres (nothing in memory between requests):
- `usage` counts each visitor's questions per day. Its daily sum is also the
  demo-wide total for DAILY_QUESTION_CAP, because it is counted *before* the
  question is answered, so concurrent requests can't overshoot the cap.
- `queries` logs every answered question for the Admin page.

Visitors are identified by a salted hash of their IP, never the IP itself.
Days roll over at midnight in the database's timezone (UTC on Neon).
"""

import hashlib
import logging
from functools import cache
from typing import Literal

from fastapi import Request
from psycopg.types.json import Jsonb

from app.config import DAILY_QUESTION_CAP, PRICES_PER_MTOK, VISITOR_DAILY_LIMIT, VISITOR_HASH_SALT
from app.rag import Answer

log = logging.getLogger(__name__)

LimitReached = Literal["visitor_limit", "daily_cap"]

LIMIT_MESSAGES: dict[str, str] = {
    "visitor_limit": (
        f"You've used your {VISITOR_DAILY_LIMIT} free questions for today. "
        "Come back tomorrow to ask more."
    ),
    "daily_cap": (
        f"The demo has reached its limit of {DAILY_QUESTION_CAP} questions for today. "
        "Please try again tomorrow."
    ),
}

# Serialises check-and-count across concurrent requests. A transaction-level
# lock is released on commit, so it is safe with Neon's pooled connections.
_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtext('cite-usage'))"

_COUNTS_SQL = """
    SELECT coalesce(sum(count), 0),
           coalesce(sum(count) FILTER (WHERE visitor_hash = %s), 0)
    FROM usage
    WHERE day = current_date
"""


@cache
def _warn_missing_salt() -> None:
    log.warning("VISITOR_HASH_SALT is not set; visitor hashes are unsalted")


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded.split(",")[0].strip():
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"


def visitor_hash(request: Request) -> str:
    if not VISITOR_HASH_SALT:
        _warn_missing_salt()
    return hashlib.sha256((VISITOR_HASH_SALT + client_ip(request)).encode()).hexdigest()[:32]


def _left(total: int, mine: int) -> int:
    return max(0, min(VISITOR_DAILY_LIMIT - mine, DAILY_QUESTION_CAP - total))


def reserve(conn, vh: str) -> LimitReached | None:
    """Atomically check both limits and count one question. Returns which limit was hit, if any.

    `conn` must be in autocommit mode so the transaction below really commits.
    """
    with conn.transaction():
        conn.execute(_LOCK_SQL)
        total, mine = conn.execute(_COUNTS_SQL, (vh,)).fetchone()
        if mine >= VISITOR_DAILY_LIMIT:
            return "visitor_limit"
        if total >= DAILY_QUESTION_CAP:
            return "daily_cap"
        conn.execute(
            """
            INSERT INTO usage (visitor_hash, day, count) VALUES (%s, current_date, 1)
            ON CONFLICT (visitor_hash, day) DO UPDATE SET count = usage.count + 1
            """,
            (vh,),
        )
    return None


def refund(conn, vh: str) -> None:
    """Give a question back when it couldn't be answered (e.g. the model call failed)."""
    with conn.transaction():
        conn.execute(
            "UPDATE usage SET count = greatest(count - 1, 0) WHERE visitor_hash = %s AND day = current_date",
            (vh,),
        )


def questions_left(conn, vh: str) -> int:
    total, mine = conn.execute(_COUNTS_SQL, (vh,)).fetchone()
    return _left(total, mine)


def cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    price_in, price_out = PRICES_PER_MTOK.get(model, (0.0, 0.0))
    return (input_tokens * price_in + output_tokens * price_out) / 1_000_000


def log_query(conn, vh: str, question: str, ans: Answer) -> None:
    # Sources are stored without their text: the chunk id points back to it.
    sources = [{k: v for k, v in s.items() if k != "content"} for s in ans.sources]
    with conn.transaction():
        conn.execute(
            """
            INSERT INTO queries (visitor_hash, question, answer, found, provider, model,
                                 latency_ms, input_tokens, output_tokens, cost_usd, sources)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                vh,
                question,
                ans.text,
                ans.found,
                ans.provider,
                ans.model,
                ans.latency_ms,
                ans.input_tokens,
                ans.output_tokens,
                round(cost_usd(ans.model, ans.input_tokens, ans.output_tokens), 6),
                Jsonb(sources),
            ),
        )
