from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.db import connect

app = FastAPI(title="Cite")


@app.get("/api/health")
def health():
    """Checks that the API can reach Postgres and that pgvector is installed."""
    try:
        with connect() as conn:
            conn.execute("SELECT 1")
            row = conn.execute(
                "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')"
            ).fetchone()
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "database": "unreachable"},
        )
    return {"status": "ok", "database": "ok", "pgvector": bool(row and row[0])}
