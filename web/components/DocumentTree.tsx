import Link from "next/link";
import { CornerDownRight, Folder } from "lucide-react";
import { CATEGORIES, documentHref } from "@/constants/documents";
import { cn } from "@/lib/cn";
import type { Category, DocumentSummary } from "@/types/api";
import styles from "./DocumentTree.module.css";

interface DocumentTreeProps {
  documents: DocumentSummary[];
  /** Open folders (see hooks/useFolders). */
  open: Set<Category>;
  onToggle: (category: Category) => void;
  /** The document being read, highlighted. */
  activeId?: string;
  /** Show only this many documents per folder (the folder shows its full count). Omit to show all. */
  previewCount?: number;
  /** Where each document links to. Defaults to reading it on the Documents page. */
  hrefFor?: (doc: DocumentSummary) => string;
}

const readHref = (d: DocumentSummary) => documentHref(d.id);

/** Documents grouped into collapsible folders (categories), each linking to the Documents page (or `hrefFor`). */
export default function DocumentTree({
  documents,
  open,
  onToggle,
  activeId,
  previewCount,
  hrefFor = readHref,
}: DocumentTreeProps) {
  return (
    <ul className={styles.tree}>
      {CATEGORIES.map(({ id, label }) => {
        const docs = documents.filter((d) => d.category === id);
        if (docs.length === 0) return null;
        const isOpen = open.has(id);
        const shown = previewCount === undefined ? docs : docs.slice(0, previewCount);
        const listId = `folder-${id}`;

        return (
          <li key={id} className={styles.group}>
            <button
              type="button"
              className={styles.folder}
              aria-expanded={isOpen}
              aria-controls={listId}
              onClick={() => onToggle(id)}
            >
              <Folder size={16} fill="currentColor" strokeWidth={0} aria-hidden className={styles.folderIcon} />
              {label}
              {(!isOpen || shown.length < docs.length) && (
                <span className={styles.count} aria-label={`${docs.length} documents`}>
                  {docs.length}
                </span>
              )}
            </button>
            <ul id={listId} hidden={!isOpen}>
              {shown.map((d) => (
                <li key={d.id}>
                  <Link
                    href={hrefFor(d)}
                    className={cn(styles.doc, d.id === activeId && styles.active)}
                    aria-current={d.id === activeId ? "page" : undefined}
                    title={d.title}
                  >
                    <CornerDownRight size={14} aria-hidden className={styles.docIcon} />
                    <span className={styles.docTitle}>{d.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
