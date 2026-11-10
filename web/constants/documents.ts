import type { Category, DocumentSummary } from "@/types/api";

/** Display names for the folders under data/documents, in the order they are listed. */
export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "policies", label: "Policies" },
  { id: "contracts", label: "Contracts" },
  { id: "patient-materials", label: "Patient materials" },
];

export function categoryLabel(id: Category): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** Documents in the order the folder tree lists them: by folder (CATEGORIES order), then id. */
export function orderDocuments(documents: DocumentSummary[]): DocumentSummary[] {
  const rank = (c: Category) => CATEGORIES.findIndex((x) => x.id === c);
  return [...documents].sort(
    (a, b) => rank(a.category) - rank(b.category) || a.id.localeCompare(b.id),
  );
}

/** Link to a document on the Documents page, opened at a page, optionally with one passage highlighted. */
export function documentHref(documentId: string, page?: number, chunkId?: number): string {
  const params = new URLSearchParams({ doc: documentId });
  if (page) params.set("page", String(page));
  if (chunkId) params.set("chunk", String(chunkId));
  return `/documents?${params}`;
}
