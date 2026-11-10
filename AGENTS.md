# AGENTS.md – Cite

## What this app is

**Cite** is a company knowledge assistant that answers staff questions from the company's own documents and shows the exact source for every answer.

It is a portfolio demo. It comes pre-loaded with sample company documents (HR policies, a product manual and a few contracts), so a visitor can try it instantly with no login and nothing to upload.

## Core features

- Ask questions and get answers with numbered source tags that open the exact highlighted passage
- A clear "I couldn't find this in the documents" reply when the answer isn't there
- Hybrid document search that labels each result "exact match" or "matched by meaning"
- Contract extraction of parties, dates, payment terms and renewal clause into a table or JSON
- Admin view of questions, response time, cost and model, with a model switch and a daily usage cap
- Pre-loaded sample documents and a daily free-question limit, so visitors can try it with no login or upload

## Stack

- **Backend:** FastAPI + Uvicorn, psycopg with raw SQL (no ORM), PostgreSQL with pgvector.
- **Frontend:** Next.js (App Router), plain CSS (`globals.css` + CSS Modules), lucide-react icons.
- **Models:** openai SDK (also used for Ollama through its OpenAI-compatible endpoint) and anthropic SDK. One embedding model for everything, even when the answer model changes.
- **Deployed on:** Vercel, as two projects from this repo: `web/` (Next.js) and `api/` (FastAPI, runs as a Vercel Function).
- **Database:** Neon Postgres with pgvector, added through the Vercel Marketplace.
- **Local development:** Docker Compose (db, api, web). Vercel doesn't use it.

### Dependency limit

- Python: fastapi, uvicorn, psycopg, openai, anthropic, pypdf (reads the sample PDFs).
- JavaScript: next (with react and react-dom), lucide-react.
- Keep the total under 10. Ask before adding any new dependency.
- Do not add: LangChain, Redis, an ORM, Tailwind, a global state library, or charting libraries.

## Folder structure

```
cite/
├── AGENTS.md
├── README.md
├── docker-compose.yml         # local development only
├── .env.example
├── data/documents/            # sample company documents, as PDFs (git-ignored)
├── api/                       # FastAPI backend (Vercel project #2)
│   └── app/
│       ├── main.py, config.py, db.py, schema.sql, models.py
│       ├── llm.py             # one "ask a model" function for all 3 providers
│       ├── ingest.py          # split documents, embed, save (run once)
│       ├── search.py          # hybrid search + exact / meaning labels
│       ├── rag.py             # answer with sources, or "couldn't find this"
│       ├── extract.py         # contract → ContractDetails JSON
│       ├── usage.py           # daily cap check + cost/speed logging
│       └── routes/            # ask.py, documents.py, extract.py, admin.py
└── web/                       # Next.js frontend (Vercel project #1)
    ├── app/                   # routes and screens only
    │   ├── page.tsx           # Landing (no sidebar)
    │   └── (app)/             # ask, documents, extract, admin (with sidebar)
    ├── components/
    ├── hooks/
    ├── constants/
    ├── data/
    ├── lib/
    ├── types/
    └── public/
```

## Sample documents

The fictional company is Kestrel Valley Health Partners (KVHP). `data/documents/` holds 14 PDFs, plus `DEMO_QUESTIONS.md` (starter questions and expected answers). The folder name is the document's category:

- `policies/`: numbered HR, privacy, security and safety policies (`POL-101` … `POL-402`) and the Employee Handbook (`HR-HB-2026`).
- `contracts/`: 4 vendor contracts (`KVHP-SC-…` supply, `KVHP-IT-…` managed IT, `KVHP-BAA-…` business associate, `KVHP-NDA-…` NDA). These are what the Extract page uses.
- `patient-materials/`: the Kestrel Connect patient portal guide (`PX-GUIDE-07`).

### PDF format

All PDFs are generated the same way (ReportLab, Helvetica only, letter size). Don't edit them; `api/app/ingest.py` depends on this format.

- **ID**: PDF metadata `/Subject` (e.g. `POL-114`). Most filenames also start with it.
- **Title**: PDF metadata `/Title`. Policy titles start with the ID (`POL-114 Sick Leave and Return to Work`); ingest strips it.
- **Pages**: real PDF pages. Each page has a running header (company name, `ID | Version`) at the top and a footer (disclaimer, `Page N`) at the bottom. Ingest skips both.
- **Paragraphs**: every paragraph, table cell and list marker is its own PDF text object. Lines are hard-wrapped with no blank lines, so paragraphs come from text objects, not from plain extracted text.
- **Styles** tell the role of each block:

| Style | Meaning |
|---|---|
| Bold 18 / regular 10.5 | Title / subtitle on page 1 (skipped; already in metadata) |
| Bold 12.5 | Section heading (`4. Sick Leave Allowance`) |
| Bold 10.5 | Subsection heading (`8.1 Worked example…`, `Revision history`) |
| 9.5 (regular or bold) | Body paragraph |
| 8.8, indented | Table cell; header row in bold. Contract signature blocks are also tables. |
| 8.5, indented | Page-1 details box (Document No., Version, Owner, Effective Date…) |
| 8.5 at the margin | Small-print note (body paragraph) |
| 8.0 `\x7f` / 9.0 digit | Bullet / numbered-step marker before a list item |

### How ingest turns them into passages

- One `documents` row per PDF; `doc_type` is Policy, Handbook, Contract or Guide.
- One passage per paragraph, list item or table, never crossing a page. A passage under ~30 words merges with the next one in the same section on the same page.
- Tables become one passage, each row written as `Header: value; Header: value`. A table over 250 words is split into groups of rows.
- Each chunk stores `page`, `paragraph` (number of its first paragraph on the page, headings not counted), `section` (most specific heading) and the clean text. The embedding is made from `"Title, Section: text"`.

## Folder rules

**app/** is for routes and screens only. Screens compose components and call hooks. They should not contain large reusable UI blocks or business logic.

**components/** is for reusable UI. Create a component when it is reused in multiple places, when it makes a screen easier to read, or when it represents a clear UI concept. Examples for this app: SourceTag, SourcePanel, ResultCard. Do not create components too early.

**hooks/** holds screen logic: fetching, loading states, and reading or updating the chat.

**data/** holds hardcoded content, such as the starter questions. Keep it typed. The sample company documents live in the root `data/documents/`, because the backend reads them.

**State:** there is no store library. The chat is kept in `components/ChatProvider.tsx`, which wraps the sidebar layout so it survives moving between pages. Examples of state kept there: `messages`, `openSourceId`, `isLoading`. The model choice and usage counts live on the server. A full page refresh clears the chat, which is fine for this demo.

**lib/** holds external service helpers (`api.ts`, `cn.ts`). Never expose secret keys here. Only `NEXT_PUBLIC_` variables reach the browser; the OpenAI and Anthropic keys stay in the backend `.env`.

## Deployment rules (Vercel)

- Nothing is kept in memory between requests. Usage counts, the query log and the model choice always live in Postgres, never in a Python variable or a file.
- The database has 6 tables: documents, chunks, queries, usage, settings (holds the model choice), and extractions.
- `extractions` holds the Extract page's results: one saved ContractDetails JSON per contract + model (`document_id, provider, model, result jsonb, created_at`). `POST /api/extract` returns the saved row, or extracts, saves and returns it. Extraction uses the site default provider (not a visitor's own choice) and isn't counted against the free-question limit. A value the contract doesn't state is saved as null and shown as "Not stated".
- The browser only calls `/api/...` on the frontend address. The rewrite in `web/next.config.js` forwards it to the local api in development and to the backend project's URL in production, so FastAPI needs no CORS setup.
- The deployed backend uses Neon's pooled connection string.
- If Vercel doesn't find the FastAPI app automatically, set `tool.vercel.entrypoint` in `api/pyproject.toml`.
- The daily cap identifies visitors by IP from the request headers; if that proves unreliable behind the rewrite, use an anonymous ID cookie instead.

## Design

Every screen follows the Cite design rules: Helvetica, a warm beige background, frosted-glass cards, charcoal answer bubbles and orange (#CC8D51) accents. The full values are in `CLAUDE.md` under "Cite design rules". Match the reference screens exactly.

## Commands

- Start everything locally: `docker compose up`
- Check how the documents are split, without calling OpenAI or the database: `docker compose exec api python -m app.ingest --dry-run` (flags any passage over 250 words)
- Load the sample documents locally (after the database is up; safe to re-run): `docker compose exec api python -m app.ingest`
- Load the sample documents into Neon (safe to re-run): `docker compose exec -e DATABASE_URL="<neon direct string>" api python -m app.ingest`. Use Neon's direct (non-pooled) connection string for this bulk load; the deployed app uses the pooled one.
- Pre-fill the Extract page's results for every contract (after ingest; already-saved ones are skipped, and it adds the extractions table if missing): `docker compose exec api python -m app.extract --all`. For Neon: `docker compose exec -e DATABASE_URL="<neon direct string>" api python -m app.extract --all`. Add `--force` to re-extract saved ones (e.g. after changing the prompt or the default model).
- Deploy: push to GitHub; both Vercel projects deploy automatically
