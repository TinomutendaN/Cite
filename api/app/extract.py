"""Contract → ContractDetails, for the Extract page.

The contract's full text is rebuilt from its chunks (page and paragraph order, with
page markers) and read by the model in one structured-output call. The result is
saved in the `extractions` table, one row per contract + model, so each contract is
only read once per model. Extraction always uses the site default provider (the
settings table), never a visitor's own choice, and isn't counted against the
free-question limit.

Pre-fill every contract (safe to re-run; already-saved ones are skipped):
    python -m app.extract --all
    python -m app.extract --all --force    # re-read every contract, e.g. after changing the prompt
"""

import argparse
import logging
import sys
from pathlib import Path

from psycopg.types.json import Jsonb

from app.llm import chat, get_provider, model_for
from app.models import ContractDetails, ContractFields, ExtractResponse

log = logging.getLogger(__name__)

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


class ExtractError(Exception):
    """The model call failed or returned something that isn't valid ContractFields."""


# --- The JSON schema the model is held to -------------------------------------------
# Written out by hand so it suits both OpenAI strict mode and Anthropic structured
# outputs: every property required, additionalProperties false, null allowed through
# anyOf, and no numeric or length limits (neither accepts all of them).


def _nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


def _object(properties: dict) -> dict:
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }


_PAGE = _nullable({"type": "integer", "description": "Page marker the value appears under"})
_TEXT = _nullable({"type": "string"})
_INT = _nullable({"type": "integer"})

_DATE = _object(
    {
        "value": _nullable(
            {"type": "string", "description": "YYYY-MM-DD, only if the contract gives a calendar date"}
        ),
        "as_written": _nullable(
            {"type": "string", "description": "The contract's exact wording for this date or period"}
        ),
        "page": _PAGE,
    }
)

CONTRACT_SCHEMA = _object(
    {
        "parties": {
            "type": "array",
            "items": _object(
                {
                    "name": {"type": "string"},
                    "role": _nullable(
                        {"type": "string", "description": "The role the contract gives, e.g. supplier"}
                    ),
                    "page": _PAGE,
                }
            ),
        },
        "start_date": _DATE,
        "end_date": _DATE,
        "payment_terms": _object(
            {
                "summary": _TEXT,
                "due_days": _INT,
                "late_interest": _nullable(
                    {"type": "string", "description": "As written, e.g. 1.5% per month"}
                ),
                "page": _PAGE,
            }
        ),
        "renewal": _object(
            {
                "summary": _TEXT,
                "automatic": _nullable({"type": "boolean"}),
                "term_months": _INT,
                "notice_days": _INT,
                "page": _PAGE,
            }
        ),
    }
)

SYSTEM_PROMPT = """You read a contract and return its key details as JSON matching the schema.

Rules:
- Use only what the contract text says. Never infer, assume, calculate or invent a value.
  If the contract doesn't state something, return null for it (and null for its page).
- page is the number in the "--- Page N ---" marker the value appears under.
- parties: the organisations that sign the contract, with the role the contract gives each
  (for example "supplier" or "customer"); role null if none is given.
- start_date / end_date: as_written is the contract's exact wording for the date or period.
  value is the date as YYYY-MM-DD only when the contract gives an actual calendar date; if it
  gives a period instead (for example "24 months from the Effective Date"), value is null.
- payment_terms: summary is one or two plain sentences on when invoices are due and any late
  charge. due_days is the number of days to pay; late_interest is the late charge as written
  (for example "1.5% per month").
- renewal: summary is one or two plain sentences on how the contract renews or ends.
  automatic is true or false only if the contract says whether renewal is automatic.
  term_months is the length of each renewal in months; notice_days is the notice needed
  to stop renewal, in days. Only give numbers the contract states.
- Write summaries in plain English, using only facts from the text. Don't mention what the
  contract leaves out; a missing detail is shown by its null field."""


# --- Reading the contract -----------------------------------------------------------


def load_contract(conn, document_id: str) -> tuple[str, str, int] | None:
    """(id, title, page_count) for a contract, or None if there is no such contract."""
    return conn.execute(
        "SELECT id, title, page_count FROM documents WHERE id = %s AND category = 'contracts'",
        (document_id,),
    ).fetchone()


def contract_text(conn, document_id: str) -> str:
    """The contract's full text from its chunks, in reading order, with page markers."""
    rows = conn.execute(
        """
        SELECT page, section, content
        FROM chunks
        WHERE document_id = %s
        ORDER BY page, paragraph, id
        """,
        (document_id,),
    ).fetchall()
    lines: list[str] = []
    page = section = None
    for row_page, row_section, content in rows:
        if row_page != page:
            page, section = row_page, None
            lines.append(f"\n--- Page {page} ---")
        if row_section and row_section != section:
            section = row_section
            lines.append(f"\n## {section}")
        lines.append(content)
    return "\n".join(lines).strip()


def _clean(fields: ContractFields, page_count: int) -> ContractFields:
    """Drop pages outside the document, and pages for values that weren't found."""

    def page(p: int | None) -> int | None:
        return p if p is not None and 1 <= p <= page_count else None

    for party in fields.parties:
        party.page = page(party.page)
    fields.parties = [p for p in fields.parties if p.name.strip()]
    for d in (fields.start_date, fields.end_date):
        d.page = page(d.page) if (d.value or d.as_written) else None
    pt = fields.payment_terms
    pt.page = page(pt.page) if (pt.summary or pt.due_days is not None or pt.late_interest) else None
    r = fields.renewal
    found = r.summary or r.automatic is not None or r.term_months is not None or r.notice_days is not None
    r.page = page(r.page) if found else None
    return fields


def extract_details(conn, document_id: str, title: str, page_count: int, provider: str) -> ContractDetails:
    """One model call: the contract's text → ContractDetails. Raises ExtractError on failure."""
    text = contract_text(conn, document_id)
    if not text:
        raise ExtractError(f"{document_id} has no passages; run app.ingest first")
    user = f"Contract: {title} ({document_id})\n\n{text}\n\nReturn the contract's key details as JSON."
    try:
        result = chat(provider, SYSTEM_PROMPT, user, json_schema=CONTRACT_SCHEMA)
        fields = ContractFields.model_validate_json(result.text)
    except Exception as exc:
        raise ExtractError(f"Extracting {document_id} with {provider} failed") from exc
    fields = _clean(fields, page_count)
    return ContractDetails(document_id=document_id, contract=title, **fields.model_dump())


# --- Saved results ------------------------------------------------------------------


def get_or_extract(conn, document_id: str, force: bool = False) -> ExtractResponse | None:
    """The saved details for this contract and the site's model, extracting them first if needed.

    Returns None if there is no such contract. `conn` should be in autocommit mode, so no
    transaction is held open during the model call.
    """
    doc = load_contract(conn, document_id)
    if not doc:
        return None
    provider = get_provider(conn)
    model = model_for(provider)

    if not force:
        row = conn.execute(
            "SELECT result, created_at FROM extractions WHERE document_id = %s AND provider = %s AND model = %s",
            (document_id, provider, model),
        ).fetchone()
        if row:
            return ExtractResponse(
                provider=provider, model=model, created_at=row[1], details=ContractDetails.model_validate(row[0])
            )

    details = extract_details(conn, doc[0], doc[1], doc[2], provider)
    # Two first requests at once both extract; the first save wins and both return it.
    conflict = (
        "DO UPDATE SET result = EXCLUDED.result, created_at = now()" if force else "DO NOTHING"
    )
    conn.execute(
        f"""
        INSERT INTO extractions (document_id, provider, model, result)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (document_id, provider, model) {conflict}
        """,
        (document_id, provider, model, Jsonb(details.model_dump(mode="json"))),
    )
    row = conn.execute(
        "SELECT result, created_at FROM extractions WHERE document_id = %s AND provider = %s AND model = %s",
        (document_id, provider, model),
    ).fetchone()
    return ExtractResponse(
        provider=provider, model=model, created_at=row[1], details=ContractDetails.model_validate(row[0])
    )


# --- Command line -------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract and save contract details.")
    parser.add_argument("ids", nargs="*", help="contract ids (or use --all)")
    parser.add_argument("--all", action="store_true", help="every contract")
    parser.add_argument("--force", action="store_true", help="re-extract contracts already saved")
    args = parser.parse_args()
    if not args.all and not args.ids:
        parser.error("give contract ids or --all")

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.WARNING)

    from app.db import connect

    with connect(autocommit=True) as conn:
        conn.execute(SCHEMA_PATH.read_text(encoding="utf-8"))  # adds the extractions table if missing
        ids = args.ids or [
            r[0] for r in conn.execute("SELECT id FROM documents WHERE category = 'contracts' ORDER BY id")
        ]
        if not ids:
            print("No contracts in the database; run python -m app.ingest first")
            sys.exit(1)

        failed = 0
        for document_id in ids:
            try:
                saved = get_or_extract(conn, document_id, force=args.force)
            except ExtractError as exc:
                failed += 1
                print(f"{document_id}  failed: {exc.__cause__ or exc}")
                continue
            if saved is None:
                failed += 1
                print(f"{document_id}  not a contract")
                continue
            print(f"{document_id}  ok  {saved.provider}/{saved.model}  saved {saved.created_at:%Y-%m-%d %H:%M}")

    print(f"\n{len(ids) - failed} of {len(ids)} contracts saved")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
