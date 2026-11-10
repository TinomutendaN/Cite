"""Model calls.

embed() is shared by ingest (passages) and search (questions), so both always
use the same EMBEDDING_MODEL, whichever provider writes the answers.
chat() is the one "ask a model" function for all three answer providers.
"""

import logging
from dataclasses import dataclass

from anthropic import Anthropic
from openai import OpenAI

from app.config import (
    ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL,
    DEFAULT_PROVIDER,
    EMBEDDING_DIM,
    EMBEDDING_MODEL,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    PROVIDERS,
)

log = logging.getLogger(__name__)

TIMEOUT_SECONDS = 30
MAX_OUTPUT_TOKENS = 4096  # Anthropic: room for brief thinking plus a short answer

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


# --- Answer models ------------------------------------------------------------------


@dataclass
class ChatResult:
    text: str
    input_tokens: int
    output_tokens: int
    model: str


def get_provider(conn) -> str:
    """The provider chosen on the Admin page (settings table), or DEFAULT_PROVIDER.

    Ollama only runs locally, so if it is stored but OLLAMA_BASE_URL isn't set
    (as on the deployed site) the default is used instead.
    """
    row = conn.execute("SELECT value FROM settings WHERE key = 'provider'").fetchone()
    provider = row[0] if row else DEFAULT_PROVIDER
    if provider not in PROVIDERS:
        log.warning("Unknown provider %r in settings; using %s", provider, DEFAULT_PROVIDER)
        provider = DEFAULT_PROVIDER
    if provider == "ollama" and not OLLAMA_BASE_URL:
        log.warning("Provider is 'ollama' but OLLAMA_BASE_URL is not set; using %s", DEFAULT_PROVIDER)
        provider = DEFAULT_PROVIDER
    return provider


def model_for(provider: str) -> str:
    return {"openai": OPENAI_MODEL, "anthropic": ANTHROPIC_MODEL, "ollama": OLLAMA_MODEL}[provider]


def chat(provider: str, system: str, user: str) -> ChatResult:
    """Send one system + user message to the provider and return its text reply and token use."""
    model = model_for(provider)

    if provider == "anthropic":
        if not ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        client = Anthropic(api_key=ANTHROPIC_API_KEY, timeout=TIMEOUT_SECONDS)
        # No temperature: current Claude models reject non-default sampling values.
        # Low effort keeps thinking (billed as output) short for this simple task.
        response = client.messages.create(
            model=model,
            max_tokens=MAX_OUTPUT_TOKENS,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": "low"},
        )
        text = "".join(block.text for block in response.content if block.type == "text")
        return ChatResult(text, response.usage.input_tokens, response.usage.output_tokens, model)

    if provider == "openai":
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not set")
        client = OpenAI(api_key=OPENAI_API_KEY, timeout=TIMEOUT_SECONDS)
    elif provider == "ollama":
        if not OLLAMA_BASE_URL:
            raise RuntimeError("OLLAMA_BASE_URL is not set")
        # Ollama ignores the key, but the SDK requires one.
        client = OpenAI(base_url=OLLAMA_BASE_URL, api_key="ollama", timeout=TIMEOUT_SECONDS)
    else:
        raise ValueError(f"Unknown provider: {provider}")

    # No temperature or max_tokens: newer OpenAI models only accept the default
    # temperature, and max_tokens isn't accepted by reasoning models.
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    usage = response.usage
    return ChatResult(
        text=response.choices[0].message.content or "",
        input_tokens=(usage.prompt_tokens if usage else 0) or 0,
        output_tokens=(usage.completion_tokens if usage else 0) or 0,
        model=model,
    )
