"use client";

import { useGet } from "@/hooks/useDocuments";
import type { SearchResponse } from "@/types/api";

/** GET /api/search?q=. An empty query loads nothing. */
export function useSearch(query: string) {
  const q = query.trim();
  return useGet<SearchResponse>(q ? `/api/search?${new URLSearchParams({ q })}` : null);
}
