"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, CornerDownRight, Folder, X } from "lucide-react";
import SourceTag from "@/components/SourceTag";
import { categoryLabel, documentHref } from "@/constants/documents";
import { useDocumentPage } from "@/hooks/useDocuments";
import type { Source } from "@/types/api";
import styles from "./SourcePanel.module.css";

interface SourcePanelProps {
  source: Source;
  /** Every source of the same answer, for "Also cited". */
  sources: Source[];
  onSelect: (n: number) => void;
  onClose: () => void;
}

/** Right panel: the cited passage highlighted on its page, with the passages around it. */
export default function SourcePanel({ source, sources, onSelect, onClose }: SourcePanelProps) {
  const { data: page, error } = useDocumentPage(source.document_id, source.page);
  const scrollRef = useRef<HTMLDivElement>(null);
  const citedRef = useRef<HTMLParagraphElement>(null);
  const others = sources.filter((s) => s.n !== source.n);

  // Centre the cited passage in the passage card (without scrolling the whole page).
  useLayoutEffect(() => {
    const box = scrollRef.current;
    const cited = citedRef.current;
    if (!box || !cited) return;
    box.scrollTop = Math.max(0, cited.offsetTop - (box.clientHeight - cited.offsetHeight) / 2);
  }, [page, source.chunk_id]);

  let lastSection: string | null = null;

  return (
    <>
      <div className={`glass ${styles.titleCard}`}>
        <SourceTag n={source.n} tone="solid" active />
        <h2 className={styles.title}>Source</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close source">
          <X size={18} aria-hidden />
        </button>
      </div>

      <section className={`glass ${styles.card}`} aria-label={`Source ${source.n}`}>
        <p className={styles.folder}>
          <Folder size={16} fill="currentColor" strokeWidth={0} aria-hidden className={styles.folderIcon} />
          {page ? categoryLabel(page.category) : " "}
        </p>
        <div className={styles.doc}>
          <CornerDownRight size={15} aria-hidden className={styles.docIcon} />
          <div>
            <h3 className={styles.docTitle}>{source.title}</h3>
            <p className={styles.meta}>
              {source.section ? `${source.section} · ` : ""}Page {source.page}
            </p>
          </div>
        </div>

        <div className={styles.passages} ref={scrollRef}>
          {!page && !error && <p className={styles.status}>Loading the page…</p>}
          {error && (
            // The answer already carries the cited text, so show that if the page can't load.
            <p ref={citedRef}>
              <mark className={styles.mark}>{source.content}</mark>
            </p>
          )}
          {page?.passages.map((p) => {
            const heading = p.section && p.section !== lastSection ? p.section : null;
            lastSection = p.section;
            const cited = p.chunk_id === source.chunk_id;
            return (
              <div key={p.chunk_id}>
                {heading && <p className={styles.section}>{heading}</p>}
                <p ref={cited ? citedRef : undefined}>
                  {cited ? <mark className={styles.mark}>{p.content}</mark> : p.content}
                </p>
              </div>
            );
          })}
        </div>

        <Link href={documentHref(source.document_id, source.page, source.chunk_id)} className={`btn-secondary ${styles.open}`}>
          Open full document
          <ArrowUpRight size={14} aria-hidden />
        </Link>
      </section>

      {others.length > 0 && (
        <section className={`glass ${styles.alsoCard}`}>
          <h3 className={styles.alsoTitle}>Also cited in this answer</h3>
          <ul className={styles.alsoList}>
            {others.map((s) => (
              <li key={s.n}>
                <button type="button" className={styles.alsoItem} onClick={() => onSelect(s.n)}>
                  <SourceTag n={s.n} tone="solid" />
                  <span>
                    {s.title}, p. {s.page}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
