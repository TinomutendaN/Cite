"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Folder } from "lucide-react";
import { categoryLabel, documentHref } from "@/constants/documents";
import { useDocumentPage } from "@/hooks/useDocuments";
import type { DocumentSummary } from "@/types/api";
import styles from "./DocumentViewer.module.css";

interface DocumentViewerProps {
  document: DocumentSummary;
  page: number;
  /** Passage to highlight and scroll to, e.g. a cited source or a search result. */
  chunkId: number | null;
}

/** "4. Sick Leave Allowance" → a section ("Section 4" + title); anything else is a subheading. */
function parseHeading(section: string) {
  const m = /^(\d+)\.\s+(.+)$/.exec(section);
  return m ? { number: m[1], title: m[2] } : null;
}

/** One page of a document: its passages in reading order, with section headings. */
export default function DocumentViewer({ document: doc, page, chunkId }: DocumentViewerProps) {
  const { data, error } = useDocumentPage(doc.id, page);
  const scrollRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLParagraphElement>(null);

  // Centre the highlighted passage, or start a new page at the top.
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const mark = markRef.current;
    if (mark && box.scrollHeight <= box.clientHeight) {
      // Stacked layout: the page doesn't scroll on its own, so scroll the window.
      mark.scrollIntoView({ block: "center" });
      return;
    }
    box.scrollTop = mark ? Math.max(0, mark.offsetTop - (box.clientHeight - mark.offsetHeight) / 2) : 0;
  }, [data, chunkId]);

  let lastSection: string | null = null;

  return (
    <section className={`glass ${styles.card}`} aria-label={doc.title}>
      <header className={styles.head}>
        <Folder size={18} fill="currentColor" strokeWidth={0} aria-hidden className={styles.folderIcon} />
        <div className={styles.heading}>
          <h2 className={styles.title}>{doc.title}</h2>
          <p className={styles.meta}>
            {categoryLabel(doc.category)} · {doc.doc_type}
          </p>
        </div>
        <nav className={styles.pager} aria-label="Pages">
          <PageLink to={page - 1} doc={doc} label="Previous page">
            <ChevronLeft size={18} aria-hidden />
          </PageLink>
          <span className={styles.pageNumber} aria-label={`Page ${page} of ${doc.page_count}`}>
            Page {page}
          </span>
          <PageLink to={page + 1} doc={doc} label="Next page">
            <ChevronRight size={18} aria-hidden />
          </PageLink>
        </nav>
      </header>

      <div className={styles.paper} ref={scrollRef}>
        {!data && !error && <p className={styles.status}>Loading the page…</p>}
        {error && <p className={styles.status}>Couldn&apos;t load this page. Please try again.</p>}
        {data && data.passages.length === 0 && <p className={styles.status}>This page has no text.</p>}
        {data?.passages.map((p) => {
          const heading = p.section && p.section !== lastSection ? p.section : null;
          lastSection = p.section;
          const top = heading ? parseHeading(heading) : null;
          const marked = p.chunk_id === chunkId;
          return (
            <div key={p.chunk_id} className={styles.block}>
              {top && (
                <div className={styles.section}>
                  <p className="label">Section {top.number}</p>
                  <h3 className={styles.sectionTitle}>{top.title}</h3>
                </div>
              )}
              {heading && !top && <h4 className={styles.subheading}>{heading}</h4>}
              <p ref={marked ? markRef : undefined} className={styles.text}>
                {marked ? <mark className={styles.mark}>{p.content}</mark> : p.content}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PageLink({
  to,
  doc,
  label,
  children,
}: {
  to: number;
  doc: DocumentSummary;
  label: string;
  children: React.ReactNode;
}) {
  if (to < 1 || to > doc.page_count) {
    return (
      <span className={`${styles.pageButton} ${styles.disabled}`} aria-label={label} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link href={documentHref(doc.id, to)} className={styles.pageButton} aria-label={label}>
      {children}
    </Link>
  );
}
