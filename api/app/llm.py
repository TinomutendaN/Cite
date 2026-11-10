"""Model calls.

embed() is shared by ingest (passages) and search (questions), so both always
use the same EMBEDDING_MODEL.
"""

from openai import OpenAI

from app.config import EMBEDDING_DIM, EMBEDDING_MODEL, OPENAI_API_KEY

EMBED_BATCH_SIZE = 100


def embed(texts: list[str]) -> list[list[float]]:
    """Embed texts with EMBEDDING_MODEL, in batches. Returns vectors in input order."""
    if not texts:
        return []
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not set")

    client = OpenAI(api_key=OPENAI_API_KEY)
    vectors: list[list[float]] = []
    for start in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[start : start + EMBED_BATCH_SIZE]
        response = client.embeddings.create(model=EMBEDDING_MODEL, input=batch)
        vectors.extend(item.embedding for item in sorted(response.data, key=lambda d: d.index))

    for vector in vectors:
        if len(vector) != EMBEDDING_DIM:
            raise RuntimeError(
                f"{EMBEDDING_MODEL} returned {len(vector)} dimensions; schema expects {EMBEDDING_DIM}"
            )
    return vectors
