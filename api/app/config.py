"""Settings read from environment variables.

Docker Compose loads them from the root .env; on Vercel they are set in the
project settings. Nothing here is kept between requests except constants.
"""

import os
from pathlib import Path

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Sample PDFs. The default resolves to <repo>/data/documents when run from a
# checkout, and to /data/documents inside the api container (compose mounts
# ./data at /data), so it rarely needs setting.
DOCUMENTS_DIR = Path(
    os.environ.get("DOCUMENTS_DIR")
    or Path(__file__).resolve().parents[2] / "data" / "documents"
)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# One embedding model for everything. Stored vectors only work with the model
# that made them, and EMBEDDING_DIM must match vector(...) in schema.sql.
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIM = 1536

# --- Answer models ------------------------------------------------------------------
# The provider is chosen on the Admin page and stored in the settings table;
# DEFAULT_PROVIDER is used until then (and whenever the stored one can't be used).
PROVIDERS = ("openai", "anthropic", "ollama")
DEFAULT_PROVIDER = os.environ.get("DEFAULT_PROVIDER", "openai")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-6-luna")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-5-5")
# Empty by default: Ollama is only for the local video demo, so a deployed site
# without this set can never be switched onto it.
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")

# USD per million tokens: (input, output). Models not listed (Ollama) cost $0.
# Sources, checked 2026-11-10:
# - OpenAI: https://developers.openai.com/api/docs/pricing (Standard tier, short context)
# - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
#   (Haiku 5.5, prompts up to 100K tokens; ours are a few thousand)
PRICES_PER_MTOK: dict[str, tuple[float, float]] = {
    "gpt-6-luna": (0.10, 0.50),
    "gpt-4o-mini": (0.15, 0.60),
    "claude-haiku-5-5": (0.10, 0.50),
    "text-embedding-3-small": (0.02, 0.0),
}

# --- Search and answers -------------------------------------------------------------
RAG_TOP_K = 6                 # passages given to the model
SEARCH_CANDIDATES = 20        # results taken from each side of hybrid search before merging
# Below this best cosine similarity (and with no keyword hit) the question is
# answered "not found" without calling the model. Tune with `python -m app.check`.
# Measured 2026-11-10 (text-embedding-3-small): the lowest answerable demo question
# scored 0.287 and off-topic ones as low as 0.274, while some unanswerable ones
# scored 0.5, so this only filters clearly off-topic questions; the model's
# NOT_FOUND reply handles the rest. 0.25 keeps a margin below every answerable one.
RAG_MIN_SIMILARITY = float(os.environ.get("RAG_MIN_SIMILARITY", "0.25"))

# --- Limits -------------------------------------------------------------------------
VISITOR_DAILY_LIMIT = int(os.environ.get("VISITOR_DAILY_LIMIT", "10"))
DAILY_QUESTION_CAP = int(os.environ.get("DAILY_QUESTION_CAP", "500"))
VISITOR_HASH_SALT = os.environ.get("VISITOR_HASH_SALT", "")
