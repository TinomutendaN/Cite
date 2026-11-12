# Cite

Cite is a company knowledge assistant. Staff ask questions in plain English and get answers drawn from company documents. Every answer comes with its exact source: the document, page and paragraph it came from. Cite can also pull the key details out of contracts, and it shows admins what each answer costs and how fast it arrives.

It's a demo built on sample documents from a fictional healthcare company. Nothing needs to be uploaded and there's no login.

**Live demo:** https://cite-brown-omega.vercel.app

## What you can do

- **Ask:** ask a question and get an answer with numbered sources. Click a source to open the passage it came from. If the documents don't cover the question, Cite says "I couldn't find this in the documents" instead of guessing.
- **Documents:** browse the documents by folder (policies, contracts, patient materials), read them page by page, and search them. Each result is labelled **exact** (the words match) or **meaning** (the passage is about the same thing in different words).
- **Extract:** pick a contract and see its key details (parties, start and end dates, payment terms, renewal) as a summary card or as raw JSON.
- **Admin:** switch the model that answers (OpenAI, Anthropic or a local Ollama model) and see today's questions, cost, response speed and recent queries.

Each visitor gets a set number of free questions per day, and there is also a daily cap for the whole site.

## How it works

1. **Ingest (run once).** The sample PDFs are split into passages that keep their page, paragraph and section. Each passage is embedded and saved to Postgres with pgvector.
2. **Search.** Hybrid search runs keyword search (Postgres full-text search, plus exact matching for codes like `POL-114`) and meaning search (vector similarity) together, then merges the two lists with reciprocal rank fusion.
3. **Answer.** The top passages go to the chosen model, which writes an answer that cites them. If no passage matches the keywords and the closest match is below a similarity threshold, Cite replies "couldn't find this" without calling the model at all. Answers stream in as they're written.
4. **Extract.** A contract's full text is rebuilt from its passages and read in one structured-output call. The result is saved, so each contract is only read once per model.
5. **Log.** Every question records its tokens, cost and timing, which is what the Admin page shows.

One embedding model (`text-embedding-3-small`) is used for everything, even when the answer model changes, because stored vectors only work with the model that made them.

## Tech stack

| Part | Built with |
| --- | --- |
| Frontend | Next.js (App Router), plain CSS, lucide-react icons |
| Backend | FastAPI, raw SQL through psycopg (no ORM) |
| Database | PostgreSQL with pgvector (Neon in production) |
| Models | OpenAI SDK (also used for Ollama), Anthropic SDK |
| Hosting | Vercel (two projects), Docker Compose for local development |

The project uses few dependencies on purpose: 6 in Python (fastapi, uvicorn, psycopg, openai, anthropic, pypdf) and 2 in JavaScript (next with react, lucide-react).

## Project layout

```
api/            FastAPI backend (deployed as a Vercel Function)
  app/
    ingest.py   split PDFs into passages, embed, save
    search.py   hybrid search with exact / meaning labels
    rag.py      answer with sources, or "couldn't find this"
    extract.py  contract → structured details
    usage.py    daily caps, cost and speed logging
    check.py    run the demo questions to test answers and tune the threshold
    schema.sql  database tables
    routes/     ask, documents, extract, admin
web/            Next.js frontend
  app/          landing page and the Ask, Documents, Extract and Admin screens
  components/   shared UI
  hooks/        data fetching and screen logic
data/documents/ sample PDFs (not in git)
```

## Running it locally

You need Docker and an OpenAI API key (for embeddings and answers). An Anthropic key and Ollama are optional.

1. **Add the sample documents.** They aren't in the repo. Put the PDFs in `data/documents/`, in the `policies/`, `contracts/` and `patient-materials/` folders.

2. **Create your `.env`.**

   ```bash
   cp .env.example .env
   ```

   Fill in at least `OPENAI_API_KEY` and `VISITOR_HASH_SALT` (any random string). Every setting is explained in `.env.example`.

3. **Start everything.**

   ```bash
   docker compose up --build
   ```

   This starts Postgres (on host port 5433), the API on http://localhost:8000 and the web app on http://localhost:3000. The database schema is applied automatically the first time.

4. **Load the documents** (once, safe to re-run):

   ```bash
   docker compose exec api python -m app.ingest
   ```

   Add `--dry-run` to see how the PDFs are split without calling the API or writing to the database.

5. **Pre-fill the contract details** (optional; otherwise each contract is read the first time someone opens it):

   ```bash
   docker compose exec api python -m app.extract --all
   ```

Open http://localhost:3000. To check that the API can reach the database, open http://localhost:8000/api/health.

### Checking answer quality

```bash
docker compose exec api python -m app.check              # full answers to the demo questions
docker compose exec api python -m app.check --no-model   # search and threshold only, nearly free
```

The summary at the end compares how closely answerable and unanswerable questions match the documents, which helps you set `RAG_MIN_SIMILARITY`. Nothing is written to the usage log.

## Deploying

The repo deploys to Vercel as two projects:

| Project | Root directory | Key environment variables |
| --- | --- | --- |
| Frontend | `web` | `API_URL`: the backend project's URL |
| Backend | `api` | `DATABASE_URL` (Neon's **pooled** connection string), `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `VISITOR_HASH_SALT`, plus any limits you want to change |

The browser only calls `/api/...` on the frontend. A rewrite in `web/next.config.js` forwards those calls to the backend, so the backend needs no CORS setup.

The database is Neon Postgres with pgvector, added through the Vercel Marketplace. Before the first deploy, run `api/app/schema.sql` against it. Then run the ingest from your machine with Neon's unpooled connection string:

```bash
docker compose exec -e DATABASE_URL="<Neon unpooled connection string>" api python -m app.ingest
```

The backend keeps nothing in memory between requests. Usage counts, the query log and the model choice all live in Postgres.

Ollama only works locally. Leave `OLLAMA_BASE_URL` unset on Vercel, and a saved Ollama choice falls back to `DEFAULT_PROVIDER`.
