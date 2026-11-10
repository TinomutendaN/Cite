-- Cite schema. Safe to run more than once (local Docker init and Neon).
-- 5 tables: documents, chunks, queries, usage, settings.

CREATE EXTENSION IF NOT EXISTS vector;

-- One row per sample document (HR policy, product manual, contract).
CREATE TABLE IF NOT EXISTS documents (
    id          text PRIMARY KEY,               -- e.g. 'POL-114'
    title       text NOT NULL,
    category    text NOT NULL CHECK (category IN ('hr', 'product', 'contracts')),
    doc_type    text NOT NULL,                  -- e.g. 'Policy', 'Manual', 'Contract'
    path        text NOT NULL,                  -- relative to data/documents
    page_count  int  NOT NULL DEFAULT 1,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Searchable passages. page + paragraph let the UI highlight the exact source.
CREATE TABLE IF NOT EXISTS chunks (
    id          bigserial PRIMARY KEY,
    document_id text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page        int  NOT NULL,
    paragraph   int  NOT NULL,
    section     text,
    content     text NOT NULL,
    embedding   vector(1536),                   -- text-embedding-3-small
    tsv         tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);

CREATE INDEX IF NOT EXISTS chunks_tsv_idx       ON chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_doc_page_idx  ON chunks (document_id, page);

-- Every question asked: the Admin log. Also the source of today's overall total
-- for DAILY_QUESTION_CAP.
CREATE TABLE IF NOT EXISTS queries (
    id            bigserial PRIMARY KEY,
    created_at    timestamptz NOT NULL DEFAULT now(),
    visitor_hash  text,
    question      text NOT NULL,
    answer        text,
    found         boolean NOT NULL DEFAULT true,
    provider      text NOT NULL,                -- 'openai' | 'anthropic' | 'ollama'
    model         text NOT NULL,
    latency_ms    int,
    input_tokens  int,
    output_tokens int,
    cost_usd      numeric(10, 6) NOT NULL DEFAULT 0,
    sources       jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS queries_created_at_idx ON queries (created_at DESC);

-- Per-visitor daily counter for VISITOR_DAILY_LIMIT.
CREATE TABLE IF NOT EXISTS usage (
    visitor_hash text NOT NULL,
    day          date NOT NULL DEFAULT current_date,
    count        int  NOT NULL DEFAULT 0,
    PRIMARY KEY (visitor_hash, day)
);

-- Small key/value store. Holds the model choice set on the Admin page.
CREATE TABLE IF NOT EXISTS settings (
    key   text PRIMARY KEY,
    value text NOT NULL
);

INSERT INTO settings (key, value) VALUES ('provider', 'openai')
ON CONFLICT (key) DO NOTHING;
