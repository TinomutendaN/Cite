"""Database connection.

A fresh connection per request: nothing lives in memory between serverless
calls. prepare_threshold=None keeps it compatible with Neon's pooled
(PgBouncer) connection string.
"""

import psycopg

from app.config import DATABASE_URL


def connect(autocommit: bool = False) -> psycopg.Connection:
    """autocommit=True makes each `with conn.transaction():` block a real, committed transaction."""
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(
        DATABASE_URL, prepare_threshold=None, connect_timeout=5, autocommit=autocommit
    )


def vector_literal(vector: list[float]) -> str:
    """pgvector text format, passed as a parameter and cast with ::vector."""
    return "[" + ",".join(repr(x) for x in vector) + "]"
