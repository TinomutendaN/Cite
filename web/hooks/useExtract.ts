"use client";

import { useCallback, useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import type { ExtractResponse } from "@/types/api";

/**
 * POST /api/extract for one contract: its saved details, or extracted on the spot the
 * first time (can take several seconds). Results for an older contract are ignored.
 * Pass null to load nothing.
 */
export function useExtract(documentId: string | null) {
  const [attempt, setAttempt] = useState(0);
  const key = documentId ? `${documentId}#${attempt}` : null;
  const [state, setState] = useState<{ key: string | null; data: ExtractResponse | null; error: boolean }>({
    key: null,
    data: null,
    error: false,
  });

  useEffect(() => {
    if (!documentId) return;
    const controller = new AbortController();
    const requestKey = `${documentId}#${attempt}`;
    apiPost<ExtractResponse>("/api/extract", { document_id: documentId }, controller.signal)
      .then((data) => setState({ key: requestKey, data, error: false }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ key: requestKey, data: null, error: true });
      });
    return () => controller.abort();
  }, [documentId, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current && state.error,
    loading: Boolean(key) && !current,
    retry,
  };
}
