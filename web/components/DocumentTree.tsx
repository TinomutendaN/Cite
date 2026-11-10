import Link from "next/link";
import { CornerDownRight, Folder } from "lucide-react";
import { CATEGORIES, documentHref } from "@/constants/documents";
import type { DocumentSummary } from "@/types/api";
import styles from "./DocumentTree.module.css";

interface DocumentTreeProps {
  documents: DocumentSummary[];
}

/** Documents grouped into their folders (categories), each linking to the Documents page. */
export default function DocumentTree({ documents }: DocumentTreeProps) {
  return (
    <ul className={styles.tree}>
      {CATEGORIES.map(({ id, label }) => {
        const docs = documents.filter((d) => d.category === id);
        if (docs.length === 0) return null;
        return (
          <li key={id} className={styles.group}>
            <p className={styles.folder}>
              <Folder size={16} fill="currentColor" strokeWidth={0} aria-hidden className={styles.folderIcon} />
              {label}
            </p>
            <ul>
              {docs.map((d) => (
                <li key={d.id}>
                  <Link href={documentHref(d.id)} className={styles.doc} title={d.title}>
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
