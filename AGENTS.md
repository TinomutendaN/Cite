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

- Python: fastapi, uvicorn, psycopg, openai, anthropic.
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
├── data/documents/            # sample company documents, in Markdown
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

## Folder rules

**app/** is for routes and screens only. Screens compose components and call hooks. They should not contain large reusable UI blocks or business logic.

**components/** is for reusable UI. Create a component when it is reused in multiple places, when it makes a screen easier to read, or when it represents a clear UI concept. Examples for this app: SourceTag, SourcePanel, ResultCard. Do not create components too early.

**hooks/** holds screen logic: fetching, loading states, and reading or updating the chat.

**data/** holds hardcoded content, such as the starter questions. Keep it typed. The sample company documents live in the root `data/documents/`, because the backend reads them.

**State:** there is no store library. The chat is kept in `components/ChatProvider.tsx`, which wraps the sidebar layout so it survives moving between pages. Examples of state kept there: `messages`, `openSourceId`, `isLoading`. The model choice and usage counts live on the server. A full page refresh clears the chat, which is fine for this demo.

**lib/** holds external service helpers (`api.ts`, `cn.ts`). Never expose secret keys here. Only `NEXT_PUBLIC_` variables reach the browser; the OpenAI and Anthropic keys stay in the backend `.env`.

## Deployment rules (Vercel)

- Nothing is kept in memory between requests. Usage counts, the query log and the model choice always live in Postgres, never in a Python variable or a file.
- The database has 5 tables: documents, chunks, queries, usage, and settings (holds the model choice).
- The browser only calls `/api/...` on the frontend address. The rewrite in `web/next.config.js` forwards it to the local api in development and to the backend project's URL in production, so FastAPI needs no CORS setup.
- The deployed backend uses Neon's pooled connection string.
- If Vercel doesn't find the FastAPI app automatically, set `tool.vercel.entrypoint` in `api/pyproject.toml`.
- The daily cap identifies visitors by IP from the request headers; if that proves unreliable behind the rewrite, use an anonymous ID cookie instead.

## Design

Every screen follows the Cite design rules: Helvetica, a warm beige background, frosted-glass cards, charcoal answer bubbles and orange (#CC8D51) accents. The full values are in `CLAUDE.md` under "Cite design rules". Match the reference screens exactly.

## Commands

- Start everything locally: `docker compose up`
- Load the sample documents locally (run once, after the database is up): `docker compose exec api python -m app.ingest`
- Load the sample documents into Neon (run once, from the `api/` folder on your laptop): set `DATABASE_URL` to the Neon connection string, then run `python -m app.ingest`
- Deploy: push to GitHub; both Vercel projects deploy automatically
