# Cite

Cite is a company knowledge assistant demo. It answers staff questions from sample company documents, shows the exact source for every answer, pulls key details out of contracts, and shows admins cost and speed. Visitors try it with no login and nothing to upload.

## Project basics

- Backend: FastAPI + Uvicorn, psycopg (raw SQL, no ORM), PostgreSQL with pgvector.
- Frontend: Next.js (App Router), plain CSS (globals.css + CSS Modules), lucide-react icons.
- Models: openai SDK (also used for Ollama through its OpenAI-compatible endpoint), anthropic SDK. One embedding model for everything, even when the answer model changes.
- Deployed on Vercel as two projects from this repo: `web/` (Next.js) and `api/` (FastAPI, runs as a Vercel Function). Database: Neon Postgres with pgvector, added through the Vercel Marketplace.
- Docker Compose (db, api, web) is for local development only.
- Dependencies: 6 in Python (fastapi, uvicorn, psycopg, openai, anthropic, pypdf for reading the sample PDFs) and 2 in JavaScript (next with react/react-dom, lucide-react). Keep the total under 10. Ask before adding any new dependency.
- Do not add: LangChain, Redis, an ORM, Tailwind, a global state library, or charting libraries.

## Folder structure

```
cite/
├── README.md
├── CLAUDE.md
├── docker-compose.yml         # local development only
├── .env.example
├── data/
│   └── documents/             # sample company documents, as PDFs (git-ignored)
│       ├── policies/
│       ├── contracts/
│       └── patient-materials/
├── api/                       # Vercel project #2
│   ├── Dockerfile             # local only
│   ├── pyproject.toml         # tool.vercel.entrypoint, if Vercel doesn't find the app
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── config.py          # reads .env; model names, price list, caps
│       ├── db.py
│       ├── schema.sql         # pgvector extension + documents, chunks, queries, usage
│       ├── models.py          # Pydantic shapes (incl. ContractDetails)
│       ├── llm.py             # one "ask a model" function for all 3 providers
│       ├── ingest.py          # split documents, embed, save (run once)
│       ├── search.py          # hybrid search + exact / meaning labels
│       ├── rag.py             # answer with sources, or "couldn't find this"
│       ├── extract.py         # contract → ContractDetails JSON
│       ├── usage.py           # daily cap check + cost/speed logging
│       └── routes/
│           ├── ask.py
│           ├── documents.py
│           ├── extract.py
│           └── admin.py
└── web/                       # Vercel project #1
    ├── Dockerfile             # local only
    ├── package.json
    ├── next.config.js         # /api rewrite: local api in dev, backend project URL in production
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx           # Landing (no sidebar)
    │   └── (app)/
    │       ├── layout.tsx     # sidebar shell, wrapped in ChatProvider
    │       ├── ask/page.tsx
    │       ├── documents/page.tsx     # ?doc=… to read, ?q=… for results
    │       ├── extract/page.tsx       # ?contract=…&view=json
    │       └── admin/page.tsx
    ├── components/
    │   ├── ChatProvider.tsx
    │   ├── Sidebar.tsx
    │   ├── ChatMessage.tsx
    │   ├── SourceTag.tsx
    │   ├── SourcePanel.tsx
    │   ├── UsageMeter.tsx
    │   ├── DocumentTree.tsx
    │   └── ResultCard.tsx
    ├── hooks/
    │   ├── useAsk.ts
    │   ├── useUsage.ts
    │   └── useSearch.ts
    ├── constants/
    │   ├── nav.ts
    │   └── models.ts
    ├── data/
    │   └── starterQuestions.ts
    ├── lib/
    │   ├── api.ts
    │   └── cn.ts
    ├── types/
    │   └── api.ts
    └── public/
```

## Folder rules

- **`app/`** holds routes and screens only. Pages put components together and call hooks. No large reusable UI blocks or business logic.
- **`components/`** holds reusable UI. Create a component only when it's used in more than one place, makes a page clearly easier to read, or is a clear piece of the design. Don't create components too early.
- **`hooks/`** holds screen logic: fetching, loading states, and reading from ChatProvider.
- **`data/`** holds small hard-coded content, always typed. The sample documents stay in the root `data/documents/`, because the backend reads them.
- **`lib/`** holds helpers for calling services. No secret keys: only `NEXT_PUBLIC_` variables reach the browser, and the API keys stay in the backend `.env`.
- **No global state library.** The chat lives in ChatProvider. The model choice and usage counts live on the server.

## Vercel rules

- Nothing is kept in memory between requests. Usage counts, the query log and the model choice always live in Postgres, never in a Python variable or a file.
- The database has 5 tables: documents, chunks, queries, usage, and settings (holds the model choice).
- The browser only calls `/api/...` on the frontend address. The rewrite in `next.config.js` forwards it to the backend, so FastAPI needs no CORS setup.
- The deployed backend uses Neon's pooled connection string.
- The daily cap identifies visitors by IP from the request headers; if that proves unreliable behind the rewrite, use an anonymous ID cookie instead.

## Cite design rules

Font: 'Helvetica Neue', Helvetica, Arial, sans-serif.

Colors:
- Text: #242424 (main), #3A3532 / #4A4440 (secondary), #6B5B4B (small uppercase labels)
- Orange accent: #CC8D51 (buttons, active tags), #E1A46B (lighter orange), #F0D3B3 (highlights)
- Dark panels: #2B2B2B (answer bubbles, code boxes), #3A3A3A with #4A4A4A border (inner blocks)
- Folder icons: #F5C542. Success chip: #D6EADC background, #1F3D2B text.
- Landing page background: #F2EEE5. Landing top bar: #FBF9F4 with #E4DED2 border.

App background (all screens except landing):
background-color #DDD3CD, with linear-gradient(160deg, #E9E3DE, #D5CAC3) plus two soft white radial highlights (top-left and middle-right) and one faint taupe radial shadow near the bottom.

Glass card (all light cards on app screens):
background: rgba(255,255,255,0.34);
backdrop-filter: blur(18px) saturate(150%);
border: 1px solid rgba(255,255,255,0.65);
box-shadow: 0 8px 24px rgba(60,40,30,0.08), inset 0 1px 0 rgba(255,255,255,0.7);
border-radius: 16-18px.

Buttons: orange buttons have #1F1A16 text (not white, for readability). Secondary buttons are white with radius 12px. Every clickable element is at least 44px tall.

Small labels: 12px, uppercase, letter-spacing 0.06em, color #6B5B4B.

Layout for app screens: 24px page padding and 24px gaps. Three columns: left 230px (Cite card with orange "New chat", menu card with Ask / Documents / Extract / Admin, "Back to home" card, orange "Free demo" card), centre flexible, right 260-300px. Columns stack on narrow screens.

Shared behaviour: the left menu is the same on every app screen and highlights the current page. "Cite" and "Back to home" go to the landing page.
