"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreVertical, Search, X } from "lucide-react";
import DocumentTree from "@/components/DocumentTree";
import DocumentViewer from "@/components/DocumentViewer";
import ResultCard from "@/components/ResultCard";
import { orderDocuments } from "@/constants/documents";
import { useDocuments } from "@/hooks/useDocuments";
import { useFolders } from "@/hooks/useFolders";
import { useSearch } from "@/hooks/useSearch";
import styles from "./page.module.css";

// useSearchParams needs a Suspense boundary (cacheComponents).
export default function DocumentsPage() {
  return (
    <Suspense>
      <DocumentsScreen />
    </Suspense>
  );
}

/**
 * Reading mode: ?doc=…&page=…&chunk=… (chunk = passage to highlight).
 * Results mode: ?q=… (doc and page are kept, so clearing the search returns to them).
 */
function DocumentsScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q")?.trim() ?? "";
  const docParam = params.get("doc");
  const chunkId = Number(params.get("chunk")) || null;

  const documents = useDocuments();
  const ordered = useMemo(() => (documents.data ? orderDocuments(documents.data) : []), [documents.data]);
  // No ?doc= means the first document; an unknown one is shown as not found.
  const doc = docParam ? ordered.find((d) => d.id === docParam) : ordered[0];
  const page = doc ? Math.min(Math.max(1, Math.trunc(Number(params.get("page")) || 1)), doc.page_count) : 1;

  const folders = useFolders([], { reveal: doc?.category });
  const search = useSearch(query);

  // The search field follows the URL (back/forward, clear) and can be edited freely in between.
  const [text, setText] = useState(query);
  const [shownQuery, setShownQuery] = useState(query);
  if (query !== shownQuery) {
    setShownQuery(query);
    setText(query);
  }

  const go = (next: URLSearchParams) => router.push(next.size ? `/documents?${next}` : "/documents");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(params);
    next.delete("chunk");
    if (text.trim()) next.set("q", text.trim());
    else next.delete("q");
    go(next);
  };

  const clear = () => {
    setText("");
    const next = new URLSearchParams(params);
    next.delete("q");
    go(next);
  };

  const results = search.data?.results;

  return (
    <div className={styles.page}>
      <section className={styles.centre} aria-label="Documents">
        <header className={`glass ${styles.header}`}>
          <h1 className={styles.title}>Documents</h1>
          <form className={styles.search} role="search" onSubmit={submit}>
            <Search size={16} aria-hidden className={styles.searchIcon} />
            <input
              className={styles.input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search the documents…"
              maxLength={200}
              aria-label="Search the documents"
            />
            {query && (
              <button type="button" className={styles.clear} onClick={clear} aria-label="Clear search">
                <X size={16} aria-hidden />
              </button>
            )}
            <button type="submit" className={`btn-primary ${styles.submit}`}>
              Search
            </button>
          </form>
        </header>

        {query ? (
          <div className={styles.results} aria-live="polite">
            <div className={styles.resultsBar}>
              <p className={styles.count}>
                {results
                  ? `${results.length} ${results.length === 1 ? "result" : "results"} for “${query}”`
                  : search.error
                    ? "Search isn't working right now. Please try again."
                    : `Searching for “${query}”…`}
              </p>
              <ul className={styles.key} aria-label="Result labels">
                <li>
                  <span className={`${styles.swatch} ${styles.swatchExact}`} aria-hidden />
                  Exact match: contains your words
                </li>
                <li>
                  <span className={`${styles.swatch} ${styles.swatchMeaning}`} aria-hidden />
                  Matched by meaning: same idea, different words
                </li>
              </ul>
            </div>
            {results && results.length === 0 && (
              <p className={styles.status}>Nothing in the documents matches that. Try other words.</p>
            )}
            {results && results.length > 0 && (
              <ul className={styles.resultList}>
                {results.map((hit) => (
                  <li key={hit.chunk_id}>
                    <ResultCard hit={hit} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : doc ? (
          <DocumentViewer key={doc.id} document={doc} page={page} chunkId={chunkId} />
        ) : (
          <div className={`glass ${styles.empty}`}>
            <p className={styles.status}>
              {documents.error
                ? "Couldn't load the documents."
                : documents.data
                  ? "Couldn't find this document. Pick one from the list."
                  : "Loading documents…"}
            </p>
          </div>
        )}
      </section>

      <aside className={styles.side} aria-label="Sample documents">
        <div className={`glass ${styles.sideTitle}`}>
          <h2>Sample documents</h2>
          <FolderMenu onOpenAll={folders.openAll} onCloseAll={folders.closeAll} />
        </div>
        <div className={`glass ${styles.treeCard}`}>
          {documents.data ? (
            <DocumentTree
              documents={ordered}
              open={folders.open}
              onToggle={folders.toggle}
              activeId={query ? undefined : doc?.id}
            />
          ) : (
            <p className={styles.status}>
              {documents.error ? "Couldn't load the documents." : "Loading documents…"}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

/** The ⋮ button on the "Sample documents" card: open or close every folder. */
function FolderMenu({ onOpenAll, onCloseAll }: { onOpenAll: () => void; onCloseAll: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (action: () => void) => () => {
    action();
    setOpen(false);
  };

  return (
    <div className={styles.menuWrap} ref={ref}>
      <button
        type="button"
        className={styles.menuButton}
        aria-label="Folder options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreVertical size={18} aria-hidden />
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" className={styles.menuItem} onClick={pick(onOpenAll)}>
            Open all folders
          </button>
          <button type="button" role="menuitem" className={styles.menuItem} onClick={pick(onCloseAll)}>
            Close all folders
          </button>
        </div>
      )}
    </div>
  );
}
