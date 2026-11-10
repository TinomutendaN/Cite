"""Answer a question from the documents, citing the passages it used.

1. Hybrid search for the top RAG_TOP_K passages.
2. If nothing matched by keyword and the closest passage is still far away
   (similarity below RAG_MIN_SIMILARITY), answer "not found" without calling
   the model.
3. Otherwise give the model the numbered passages, ask it to answer only from
   them and cite them as [1], [2], or reply exactly NOT_FOUND.
4. Keep only the passages actually cited, renumbered 1, 2, 3 in the order they
   are first cited, and rewrite the citations in the text to match.
"""

import re
import time
from contextlib import nullcontext
from dataclasses import asdict, dataclass, field

from app.config import RAG_MIN_SIMILARITY, RAG_TOP_K
from app.db import connect
from app.llm import chat, get_provider, model_for
from app.search import SearchResult, hybrid_search

NOT_FOUND_TEXT = "I couldn't find this in the documents."
NOT_FOUND_TOKEN = "NOT_FOUND"

SYSTEM_PROMPT = f"""You answer questions from staff at Kestrel Valley Health Partners using only the numbered passages from company documents that you are given.

Rules:
- Use only facts stated in the passages. Never use outside knowledge, and never guess.
- After each sentence or claim, cite the passage(s) it comes from in square brackets, like [1] or [2][3]. Cite only passages that support the claim.
- If the passages do not contain the answer, reply with exactly {NOT_FOUND_TOKEN} and nothing else.
- If they answer only part of the question, answer that part and say plainly what the documents don't cover.
- Be brief and direct: a short paragraph or a few bullet points. Keep exact figures, deadlines, phone numbers and extensions as written."""

# [1]  [1][2]  [1, 2]  [1,2,3]
CITATION_RE = re.compile(r"\[(\d+(?:\s*,\s*\d+)*)\]")


@dataclass
class Answer:
    text: str
    found: bool
    sources: list[dict]  # cited passages, renumbered; see models.Source
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    gated: bool = False  # True when "not found" was decided without calling the model
    uncited: bool = False  # True when the model answered but cited no valid passage
    passages: list[SearchResult] = field(default_factory=list)  # everything retrieved


def build_user_message(question: str, passages: list[SearchResult]) -> str:
    blocks = []
    for n, p in enumerate(passages, start=1):
        where = f"{p.title} ({p.document_id})"
        if p.section:
            where += f", {p.section}"
        blocks.append(f"[{n}] {where}, page {p.page}\n{p.content}")
    return f"Question: {question}\n\nPassages:\n\n" + "\n\n".join(blocks)


def is_not_found(text: str) -> bool:
    return text.strip().strip("\"'`*.").strip().upper() == NOT_FOUND_TOKEN


def renumber_citations(text: str, count: int) -> tuple[str, list[int]]:
    """Rewrite citations to 1..n in order of first appearance.

    Returns the new text and the cited passage indexes (0-based, in new order).
    Numbers outside 1..count are dropped.
    """
    new_number: dict[int, int] = {}
    dropped = False

    def replace(match: re.Match) -> str:
        nonlocal dropped
        out = []
        for raw in match.group(1).split(","):
            old = int(raw)
            if not 1 <= old <= count:
                dropped = True
                continue
            if old not in new_number:
                new_number[old] = len(new_number) + 1
            if new_number[old] not in out:
                out.append(new_number[old])
        return "".join(f"[{n}]" for n in out)

    rewritten = CITATION_RE.sub(replace, text)
    # Tidy spaces left where an invalid citation was removed.
    rewritten = re.sub(r"[ \t]+([.,;:])", r"\1", rewritten)
    rewritten = re.sub(r"[ \t]{2,}", " ", rewritten).strip()
    cited = [old - 1 for old, _ in sorted(new_number.items(), key=lambda item: item[1])]
    return rewritten, cited


def source_dict(n: int, p: SearchResult) -> dict:
    data = asdict(p)
    data.pop("score")
    data["similarity"] = round(p.similarity, 4)
    return {"n": n, **data}


def should_skip_model(passages: list[SearchResult]) -> bool:
    """True when the passages are clearly unrelated: no keyword hit and nothing close in meaning."""
    if not passages:
        return True
    has_keyword_hit = any(p.match_type == "exact" for p in passages)
    best_similarity = max(p.similarity for p in passages)
    return not has_keyword_hit and best_similarity < RAG_MIN_SIMILARITY


def answer(question: str, provider: str | None = None, conn=None) -> Answer:
    started = time.perf_counter()

    def elapsed_ms() -> int:
        return int((time.perf_counter() - started) * 1000)

    with nullcontext(conn) if conn is not None else connect() as c:
        provider = provider or get_provider(c)
        passages = hybrid_search(question, RAG_TOP_K, conn=c)

    model = model_for(provider)

    if should_skip_model(passages):
        return Answer(
            text=NOT_FOUND_TEXT,
            found=False,
            sources=[],
            provider=provider,
            model=model,
            latency_ms=elapsed_ms(),
            gated=True,
            passages=passages,
        )

    result = chat(provider, SYSTEM_PROMPT, build_user_message(question, passages))
    base = dict(
        provider=provider,
        model=result.model,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        passages=passages,
    )

    if is_not_found(result.text):
        return Answer(text=NOT_FOUND_TEXT, found=False, sources=[], latency_ms=elapsed_ms(), **base)

    text, cited = renumber_citations(result.text, len(passages))
    if not cited:
        # Every answer must show its source; an uncited reply counts as not found.
        return Answer(
            text=NOT_FOUND_TEXT, found=False, sources=[], latency_ms=elapsed_ms(), uncited=True, **base
        )

    sources = [source_dict(n, passages[i]) for n, i in enumerate(cited, start=1)]
    return Answer(text=text, found=True, sources=sources, latency_ms=elapsed_ms(), **base)
