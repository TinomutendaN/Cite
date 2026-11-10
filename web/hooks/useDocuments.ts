"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { DocumentPage, DocumentSummary } from "@/types/api";

type Loadable<T> = { data: T | null; error: boolean; loading: boolean };

function useGet<T>(path: string | null): Loadable<T> {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: boolean }>({
    path: null,
    data: null,
    error: false,
  });

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    apiGet<T>(path, controller.signal)
      .then((data) => setState({ path, data, error: false }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ path, data: null, error: true });
      });
    return () => controller.abort();
  }, [path]);

  // Results for an older path are ignored, so switching sources never shows the wrong page.
  const current = state.path === path;
  return {
    data: current ? state.data : null,
    error: current && state.error,
    loading: Boolean(path) && !current,
  };
}

/** GET /api/documents */
export function useDocuments() {
  return useGet<DocumentSummary[]>("/api/documents");
}

/** GET /api/documents/{id}/pages/{page}. Pass null to load nothing. */
export function useDocumentPage(documentId: string | null, page: number | null) {
  const path =
    documentId && page ? `/api/documents/${encodeURIComponent(documentId)}/pages/${page}` : null;
  return useGet<DocumentPage>(path);
}
