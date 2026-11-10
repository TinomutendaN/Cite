"""Load the sample PDFs into the documents and chunks tables.

Run once after the database is up (safe to re-run):
    python -m app.ingest             # parse, embed, save
    python -m app.ingest --dry-run   # parse and print passages only (no API, no DB)

How the PDFs are laid out (all generated the same way, Helvetica only):
- ID in the PDF metadata /Subject, title in /Title, category = folder name.
- Every paragraph, table cell and list marker is its own PDF text object, so
  grouping text by text object (BT..ET) gives exact paragraphs even though the
  lines are hard-wrapped with no blank lines.
- Style tells the role of each block:
    Bold 18 title, regular 10.5 subtitle (skipped; they are in the metadata)
    Bold 12.5 section heading, Bold 10.5 subsection heading
    9.5 body paragraph (regular or bold)
    8.8 table cell (header row in bold), 8.5 page-1 details box
    8.0 "\\x7f" bullet marker, 9.0 digit = numbered-step marker
- Running header (y > 740) and footer (y < 50) are on every page.
"""

import argparse
import sys
from dataclasses import dataclass, field
from pathlib import Path

import pypdf
from pypdf import mult

from app.config import DOCUMENTS_DIR

SHORT_PASSAGE_WORDS = 30  # merge paragraphs shorter than this with the next one
LONG_PASSAGE_WORDS = 250  # split tables longer than this; flag anything longer in --dry-run

HEADER_MIN_Y = 740
FOOTER_MAX_Y = 50
TABLE_MIN_X = 64

DOC_TYPES = {"policies": "Policy", "contracts": "Contract", "patient-materials": "Guide"}

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


# --- Reading the PDF -----------------------------------------------------------


@dataclass
class Block:
    """The text of one PDF text object, with the style of its first fragment."""

    x: float
    y: float
    size: float
    bold: bool
    text: str = ""

    @property
    def clean(self) -> str:
        return " ".join(self.text.split())


def read_blocks(page: pypdf.PageObject) -> list[Block]:
    blocks: list[Block] = []
    starts_new_block = True

    def before_operator(op, args, cm, tm):
        nonlocal starts_new_block
        if op == b"BT":
            starts_new_block = True

    def on_text(text, cm, tm, font_dict, font_size):
        nonlocal starts_new_block
        if not text:
            return
        if starts_new_block:
            if not text.strip():
                return
            # Only the first line of a text object has a reliable absolute position.
            matrix = mult(tm, cm)
            font = str((font_dict or {}).get("/BaseFont", ""))
            blocks.append(Block(x=matrix[4], y=matrix[5], size=round(font_size or 0, 1), bold="Bold" in font))
            starts_new_block = False
        blocks[-1].text += text

    page.extract_text(visitor_operand_before=before_operator, visitor_text=on_text)
    return blocks


def is_bullet(block: Block) -> bool:
    return block.clean == "\x7f"


def is_step_number(block: Block) -> bool:
    return block.size == 9.0 and block.clean.isdigit()


def is_table_cell(block: Block) -> bool:
    # Cells are indented (x >= 66); 8.5 small print at the body margin (x = 60) is a note.
    return block.size in (8.8, 8.5) and block.x >= TABLE_MIN_X


# --- Tables --------------------------------------------------------------------


def table_rows(cells: list[Block]) -> list[list[Block]]:
    """Group cells into rows by their starting y (cells of a row share it)."""
    rows: list[list[Block]] = []
    for cell in cells:
        if rows and abs(rows[-1][0].y - cell.y) < 1:
            rows[-1].append(cell)
        else:
            rows.append([cell])
    return rows


def split_tables(cells: list[Block]) -> list[list[list[Block]]]:
    """A run of cells can hold several tables; a new all-bold row starts a new one."""
    tables: list[list[list[Block]]] = []
    for row in table_rows(cells):
        starts_table = (
            not tables
            or row[0].size != tables[-1][0][0].size
            or (all(c.bold for c in row) and len(tables[-1]) > 1)
        )
        if starts_table:
            tables.append([row])
        else:
            tables[-1].append(row)
    return tables


def render_table(rows: list[list[Block]]) -> list[str]:
    """Render a table as text lines, one per data row.

    With a bold header row, each row reads "Header: value; Header: value", so
    every line carries its column names. The page-1 details box (label, value,
    label, value) reads "Label: value; Label: value".
    """
    if rows[0][0].size == 8.5:
        lines = []
        for row in rows:
            cells = [c.clean for c in row]
            pairs = [f"{cells[i]}: {cells[i + 1]}" for i in range(0, len(cells) - 1, 2)]
            lines.append("; ".join(pairs))
        return lines

    header = rows[0]
    if all(c.bold for c in header) and len(rows) > 1:
        # Columns are matched by x, so a row with a missing cell still lines up.
        names = [(c.x, c.clean) for c in header]
        lines = []
        for row in rows[1:]:
            parts = []
            for cell in row:
                name = min(names, key=lambda n: abs(n[0] - cell.x))[1]
                parts.append(f"{name}: {cell.clean}")
            lines.append("; ".join(parts))
        return lines

    # No header (e.g. contract signature blocks): plain rows.
    return [" | ".join(c.clean for c in row) for row in rows]


def group_lines(lines: list[str], max_words: int) -> list[str]:
    """Join table lines into groups of at most max_words (a single long row stays whole)."""
    groups: list[list[str]] = [[]]
    words = 0
    for line in lines:
        n = len(line.split())
        if groups[-1] and words + n > max_words:
            groups.append([])
            words = 0
        groups[-1].append(line)
        words += n
    return ["\n".join(g) for g in groups]


# --- Parsing a document ----------------------------------------------------------


@dataclass
class Paragraph:
    page: int
    number: int  # 1-based, within the page
    section: str | None
    text: str
    is_table: bool = False


@dataclass
class Passage:
    page: int
    paragraph: int  # number of the first paragraph within the page
    section: str | None
    parts: list[str] = field(default_factory=list)

    @property
    def content(self) -> str:
        return "\n".join(self.parts)

    @property
    def words(self) -> int:
        return len(self.content.split())


def page_paragraphs(blocks: list[Block], page_no: int, heading: dict) -> list[Paragraph]:
    """Turn one page's blocks into paragraphs. `heading` carries the section across pages."""
    paragraphs: list[Paragraph] = []
    prefix = ""
    i = 0

    def current_section() -> str | None:
        return heading["sub"] or heading["main"]

    def add(text: str, is_table: bool = False, section: str | None = None):
        paragraphs.append(
            Paragraph(page_no, len(paragraphs) + 1, section or current_section(), text, is_table)
        )

    while i < len(blocks):
        block = blocks[i]
        text = block.clean

        if block.y > HEADER_MIN_Y or block.y < FOOTER_MAX_Y or not text:
            i += 1
        elif block.size == 18.0 or (block.size == 10.5 and not block.bold):
            i += 1  # title and subtitle: already in the metadata
        elif block.size == 12.5 and block.bold:
            heading["main"], heading["sub"] = text, None
            i += 1
        elif block.size == 10.5 and block.bold:
            heading["sub"] = text
            i += 1
        elif is_bullet(block):
            prefix = "• "
            i += 1
        elif is_step_number(block):
            prefix = f"{text}. "
            i += 1
        elif is_table_cell(block):
            j = i
            while j < len(blocks) and is_table_cell(blocks[j]):
                j += 1
            for rows in split_tables(blocks[i:j]):
                section = "Document details" if rows[0][0].size == 8.5 else None
                add("\n".join(render_table(rows)), is_table=True, section=section)
            i = j
        else:
            add(prefix + text)
            prefix = ""
            i += 1

    return paragraphs


def make_passages(paragraphs: list[Paragraph]) -> list[Passage]:
    """One paragraph per passage; a short one merges with the next in the same page and section.
    Tables over LONG_PASSAGE_WORDS are split into row groups first."""
    pieces: list[Paragraph] = []
    for p in paragraphs:
        if p.is_table and len(p.text.split()) > LONG_PASSAGE_WORDS:
            for group in group_lines(p.text.split("\n"), LONG_PASSAGE_WORDS):
                pieces.append(Paragraph(p.page, p.number, p.section, group, True))
        else:
            pieces.append(p)

    passages: list[Passage] = []
    for p in pieces:
        last = passages[-1] if passages else None
        if (
            last
            and last.words < SHORT_PASSAGE_WORDS
            and last.page == p.page
            and last.section == p.section
        ):
            last.parts.append(p.text)
        else:
            passages.append(Passage(p.page, p.number, p.section, [p.text]))
    return passages


def parse_pdf(path: Path, root: Path) -> tuple[dict, list[Passage]]:
    reader = pypdf.PdfReader(path)
    meta = reader.metadata or {}

    doc_id = str(meta.get("/Subject") or "").strip() or path.stem.split("_")[0]
    title = str(meta.get("/Title") or "").strip() or path.stem.replace("_", " ")
    if title.startswith(doc_id + " "):
        title = title[len(doc_id) + 1 :]
    category = path.relative_to(root).parts[0]
    doc_type = "Handbook" if "Handbook" in title else DOC_TYPES.get(category, "Document")

    doc = {
        "id": doc_id,
        "title": title,
        "category": category,
        "doc_type": doc_type,
        "path": path.relative_to(root).as_posix(),
        "page_count": len(reader.pages),
    }

    heading = {"main": None, "sub": None}
    passages: list[Passage] = []
    for page_no, page in enumerate(reader.pages, start=1):
        # Passages are built per page, so none crosses a page boundary.
        passages.extend(make_passages(page_paragraphs(read_blocks(page), page_no, heading)))
    return doc, passages


def embedding_text(title: str, section: str | None, content: str) -> str:
    return f"{title}, {section}: {content}" if section else f"{title}: {content}"


# --- Saving ------------------------------------------------------------------------


def vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(repr(x) for x in vector) + "]"


def save_document(conn, doc: dict, passages: list[Passage], vectors: list[list[float]]) -> None:
    """Replace one document and its chunks in a single transaction."""
    with conn.transaction():
        conn.execute(
            """
            INSERT INTO documents (id, title, category, doc_type, path, page_count)
            VALUES (%(id)s, %(title)s, %(category)s, %(doc_type)s, %(path)s, %(page_count)s)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                category = EXCLUDED.category,
                doc_type = EXCLUDED.doc_type,
                path = EXCLUDED.path,
                page_count = EXCLUDED.page_count
            """,
            doc,
        )
        conn.execute("DELETE FROM chunks WHERE document_id = %s", (doc["id"],))
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO chunks (document_id, page, paragraph, section, content, embedding)
                VALUES (%s, %s, %s, %s, %s, %s::vector)
                """,
                [
                    (doc["id"], p.page, p.paragraph, p.section, p.content, vector_literal(v))
                    for p, v in zip(passages, vectors, strict=True)
                ],
            )


# --- Main --------------------------------------------------------------------------


def load_all(root: Path) -> list[tuple[dict, list[Passage]]]:
    paths = sorted(root.glob("*/*.pdf"))
    if not paths:
        raise SystemExit(f"No PDFs found under {root} (set DOCUMENTS_DIR?)")

    parsed = [parse_pdf(path, root) for path in paths]
    seen: dict[str, str] = {}
    for doc, _ in parsed:
        if doc["id"] in seen:
            raise SystemExit(f"Duplicate document ID {doc['id']}: {seen[doc['id']]} and {doc['path']}")
        seen[doc["id"]] = doc["path"]
    return parsed


def print_dry_run(parsed: list[tuple[dict, list[Passage]]]) -> None:
    long_count = 0
    for doc, passages in parsed:
        print(f"\n=== {doc['id']} | {doc['title']} | {doc['category']} | {doc['doc_type']} | {doc['page_count']} pages")
        for p in passages:
            flag = ""
            if p.words > LONG_PASSAGE_WORDS:
                flag = f"  ⚠ LONG ({p.words} words)"
                long_count += 1
            print(f"\n[p{p.page} ¶{p.paragraph}] {p.section or '(no section)'}  ({p.words} words){flag}")
            print(p.content)
    print(f"\nPassages over {LONG_PASSAGE_WORDS} words: {long_count}")


def print_summary(parsed: list[tuple[dict, list[Passage]]]) -> None:
    print()
    width = max(len(doc["id"]) for doc, _ in parsed)
    for doc, passages in parsed:
        print(f"{doc['id']:<{width}}  {doc['page_count']} pages  {len(passages):>3} passages  {doc['title']}")
    total = sum(len(passages) for _, passages in parsed)
    print(f"\n{len(parsed)} documents loaded, {total} passages in total")


def main() -> None:
    parser = argparse.ArgumentParser(description="Load the sample PDFs into Postgres.")
    parser.add_argument("--dry-run", action="store_true", help="parse and print passages only")
    args = parser.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    root = Path(DOCUMENTS_DIR)
    parsed = load_all(root)

    if args.dry_run:
        print_dry_run(parsed)
        print_summary(parsed)
        return

    # Imported here so --dry-run works without the DB or API keys.
    from app.db import connect
    from app.llm import embed

    with connect() as conn:
        conn.execute(SCHEMA_PATH.read_text(encoding="utf-8"))
        conn.commit()
        for doc, passages in parsed:
            # Embed before opening the transaction, so an API error leaves the DB untouched.
            vectors = embed([embedding_text(doc["title"], p.section, p.content) for p in passages])
            save_document(conn, doc, passages, vectors)
            print(f"saved {doc['id']} ({len(passages)} passages)")

    print_summary(parsed)


if __name__ == "__main__":
    main()
