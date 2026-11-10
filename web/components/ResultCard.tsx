import Link from "next/link";
import { Check, Folder, Loader } from "lucide-react";
import { documentHref } from "@/constants/documents";
import { cn } from "@/lib/cn";
import type { SearchHit } from "@/types/api";
import styles from "./ResultCard.module.css";

/** The snippet with its highlighted parts wrapped in <mark>. */
function Highlighted({ hit }: { hit: SearchHit }) {
  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const [start, end] of hit.highlights) {
    if (start < pos) continue;
    if (start > pos) parts.push(hit.snippet.slice(pos, start));
    parts.push(
      <mark key={start} className={styles.mark}>
        {hit.snippet.slice(start, end)}
      </mark>,
    );
    pos = end;
  }
  parts.push(hit.snippet.slice(pos));
  return <>{parts}</>;
}

/** One search result: opens the document at that page with the passage highlighted. */
export default function ResultCard({ hit }: { hit: SearchHit }) {
  const exact = hit.match_type === "exact";
  return (
    <Link
      href={documentHref(hit.document_id, hit.page, hit.chunk_id)}
      className={cn("glass", styles.card, exact ? styles.exact : styles.meaning)}
    >
      <span className={styles.top}>
        <Folder size={16} fill="currentColor" strokeWidth={0} aria-hidden className={styles.folderIcon} />
        <span className={styles.title}>{hit.title}</span>
        <span className={styles.page}>· Page {hit.page}</span>
        <span className={styles.chip}>
          {exact ? <Check size={12} aria-hidden /> : <Loader size={12} aria-hidden />}
          {exact ? "Exact match" : "Matched by meaning"}
        </span>
      </span>
      <span className={styles.snippet}>
        <Highlighted hit={hit} />
      </span>
    </Link>
  );
}
