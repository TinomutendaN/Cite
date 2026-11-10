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
