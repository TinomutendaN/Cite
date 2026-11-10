# Cite – Tech Stack (48-hour sprint, deployed on Vercel)

Your plan already fixes the core (FastAPI, PostgreSQL with pgvector, Next.js, Docker, Ollama), and you're deploying on Vercel, so this fills in everything around it. The guiding rule is to use what those core pieces already include before adding a library. That's what keeps the count low.

## The stack

### Backend

| Need | Pick | Why | Alternative considered |
|---|---|---|---|
| API server | **FastAPI + Uvicorn** | Already your choice and your strongest tool. Pydantic comes with it, which covers request checking and the contract-extraction JSON. | Django: slower to set up and too much for 5 pages. |
| Database access | **psycopg (v3), raw SQL** | You'll have about 4 tables. Plain SQL is quicker to write than setting up an ORM, and the vector and full-text queries are raw SQL anyway. | SQLAlchemy: worth it in a long-lived app, but adds setup and migration time for no demo benefit. |
| OpenAI and local model | **openai SDK** | One SDK covers both. Ollama exposes an OpenAI-compatible endpoint, so the local switch is just a different base URL and model name. | Ollama's own Python package: one more dependency for the same result. |
| Anthropic | **anthropic SDK** | Direct, light, and gives you token counts for the cost column. | LiteLLM: one library for all three providers, but heavy and harder to debug at 2 a.m. |
| Embeddings | **OpenAI's small embedding model, via the openai SDK** | Cheap and good. Keep **one** embedding model for everything, even when the answer model switches, because stored vectors only work with the model that made them. | Ollama embeddings: free, but local mode would need its own copy of every vector. |
| Text splitting | **Your own ~30-line function** (split by headings, then paragraphs) | Your sample documents are clean and written by you, so a simple splitter is enough. It also keeps page and paragraph positions, which the source highlighting needs. | LangChain splitters: you know LangChain well, but it pulls in a large dependency tree for one function. |
| Hybrid search | **Postgres full-text search + pgvector, merged in Python** | Both are built into Postgres, so this adds no new library. Run a keyword query and a vector query, then merge the results. A result found by the keyword query is labelled "exact match"; one found only by the vector query is "matched by meaning". | Elasticsearch or a separate vector database such as Qdrant: an extra service to run and deploy for no visible gain. |
| Contract extraction | **LLM in JSON mode, checked with Pydantic** | Pydantic is already installed with FastAPI. Define a `ContractDetails` model and reject anything that doesn't fit it. | Instructor: nicer to use, but one more dependency for 4 fields. |
| Daily cap and rate limit | **A Postgres counter table** (hashed visitor IP + date) | No Redis needed. One `UPDATE … RETURNING` both counts the question and checks it against the cap. | SlowAPI + Redis: an extra library and an extra service. |
| Cost and speed log | **A `queries` table**, with cost worked out from the token counts the APIs return and a small price list in config | This table is the Admin page. | Langfuse or Helicone: good for study, but an extra hosted service and an extra integration. |

### Frontend

| Need | Pick | Why | Alternative considered |
|---|---|---|---|
| Framework | **Next.js (App Router)** | Already your choice. Use plain `fetch` to the FastAPI backend. | Vite + React: just as fast, but you'd lose the easy routing for 5 pages. |
| Styling | **Plain CSS: one global file with CSS variables, plus CSS Modules** | Built into Next.js. The design is mostly custom values (glass cards, exact colors), which map directly onto CSS variables from the design rules file. | Tailwind: quick, but adds setup, and every glass card would end up as long custom class strings. |
| Icons | **lucide-react** | The designs already use that thin-stroke icon style. Claude Code can use it straight away. | Inline SVGs: no dependency, but slower to manage across 8 screens. |
| Data fetching | **Plain `fetch` + React state** | Five pages with simple calls don't need a data library. | SWR or React Query: helpful at scale, unnecessary here. |
| Document viewer | **Render stored pages and paragraphs as plain HTML** | The backend already splits documents into pages and paragraphs, so the viewer just lists them and highlights the matching paragraph. | react-markdown or a PDF viewer: an extra dependency and harder highlighting. |

### Infrastructure

| Need | Pick | Why | Alternative considered |
|---|---|---|---|
| Frontend hosting | **Vercel project #1, using the `web/` folder** | Next.js is what Vercel does best: no setup, HTTPS and a `.vercel.app` address included. | A VPS (rented server): one machine for everything, but you'd manage the server and HTTPS yourself. |
| Backend hosting | **Vercel project #2, using the `api/` folder** | Vercel finds the FastAPI `app` and runs it as a single Vercel Function. Same repo, same dashboard as the frontend. If it isn't found automatically, point to it with `tool.vercel.entrypoint` in `api/pyproject.toml`. | Railway or Render: a normal always-on server, but one more platform and dashboard. |
| Database | **Neon Postgres, added from the Vercel Marketplace**, with `CREATE EXTENSION vector;` run once | Vercel's own Postgres has been replaced by Neon. Billing and the connection string come through Vercel, and Neon supports pgvector. Use the **pooled** connection string for the deployed backend. | Supabase: also has pgvector, but brings login and file storage you don't need. |
| One web address | **The `/api` rewrite in `next.config.js`**, pointing at the backend project's URL in production | Visitors only see the frontend address, and you avoid any cross-site (CORS) setup. | Calling the backend's URL directly from the browser: needs CORS settings on FastAPI. |
| Local development | **Docker Compose** with 3 services: `pgvector/pgvector` Postgres image, the API, and the Next.js web app | Runs everything on your laptop with one command, which is also the start command shown in the README at the end of the video. Vercel doesn't use it. | Running each part by hand: three terminals and easy to get out of sync. |
| Local model | **Ollama on your own machine, for the video only** | Your plan already says the local switch is shown in the video. Public visitors use the cheap hosted model. | Hosting Ollama somewhere: needs a large, expensive server, and Vercel can't run it. |
| Sample documents | **Write them as Markdown**, with a simple marker for page breaks. Load them into Neon by running `ingest.py` from your laptop with the Neon connection string. | No PDF-reading library needed, and you control the exact text, page numbers and IDs such as "POL-114". | Real PDFs + pypdf: more realistic, but one more dependency plus messier text. |

## Dependency count

| Side | Packages | Count |
|---|---|---|
| Python | fastapi, uvicorn, psycopg, openai, anthropic | 5 |
| JavaScript | next (with react and react-dom), lucide-react | 2 |
| **Total** | | **7** |

Vercel, Neon, Postgres, pgvector, Docker, and Ollama aren't counted because they're services, not code libraries. Neither are the development tools that come with `create-next-app`, such as TypeScript.

## Three things to check in your plan

1. **"Drop in a contract" in the video vs "pick a sample contract" on the page.** Picking needs no extra libraries. If you want to drop in a file on camera, add `python-multipart` for file uploads, plus `pypdf` if the file is a PDF. That makes 9, still under 10. I'd keep "pick" and change the shot list.
2. **Searching for "POL-114".** Postgres full-text search can split hyphenated codes in unexpected ways. Add a simple exact-text match (`ILIKE`) alongside the full-text query, and test that exact search early, since it's in the video.
3. **Local mode still uses OpenAI for embeddings.** That's fine for the demo. Just don't claim on camera that local mode runs fully offline.

## Things to watch on Vercel

1. **Nothing is kept in memory between requests.** Serverless functions start and stop on demand, so usage counts, the query log and the model choice must all live in Postgres, never in a Python variable.
2. **The visitor's IP for the daily cap.** Requests pass through the Next.js rewrite before reaching FastAPI, so check which header actually carries the visitor's IP once deployed. If it isn't reliable, give each visitor an anonymous ID in a cookie instead.
3. **The first request after a quiet period can be slow** while the function starts up. Open the app and ask one question before recording the video.
4. **Deploy early.** At hours 0–4, create both Vercel projects and the Neon database, and confirm the frontend reaches the backend through the rewrite. That's the step most likely to cause surprises.

## Leave out

LangChain, Redis, an ORM, Tailwind, and charting libraries. None of the five pages needs them, and each one adds setup time you don't have.
