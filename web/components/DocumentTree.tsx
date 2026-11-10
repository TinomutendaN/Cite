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
}

/** Documents grouped into collapsible folders (categories), each linking to the Documents page. */
export default function DocumentTree({ documents, open, onToggle, activeId }: DocumentTreeProps) {
  return (
    <ul className={styles.tree}>
      {CATEGORIES.map(({ id, label }) => {
        const docs = documents.filter((d) => d.category === id);
        if (docs.length === 0) return null;
        const isOpen = open.has(id);
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
              {!isOpen && (
                <span className={styles.count} aria-label={`${docs.length} documents`}>
                  {docs.length}
                </span>
              )}
            </button>
            <ul id={listId} hidden={!isOpen}>
              {docs.map((d) => (
                <li key={d.id}>
                  <Link
                    href={documentHref(d.id)}
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
