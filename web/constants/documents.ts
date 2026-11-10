import type { Category } from "@/types/api";

/** Display names for the folders under data/documents, in the order they are listed. */
export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "policies", label: "Policies" },
  { id: "contracts", label: "Contracts" },
  { id: "patient-materials", label: "Patient materials" },
];

export function categoryLabel(id: Category): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** Link to a document on the Documents page, opened at a page. */
export function documentHref(documentId: string, page?: number): string {
  const params = new URLSearchParams({ doc: documentId });
  if (page) params.set("page", String(page));
  return `/documents?${params}`;
}
