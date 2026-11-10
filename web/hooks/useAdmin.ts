"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { AdminQueriesResponse, AdminQuery, AdminSummary } from "@/types/api";

/** Today's site-wide figures and this visitor's recent questions. Neither counts against the limit. */
export function useAdmin() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [queries, setQueries] = useState<AdminQuery[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiGet<AdminSummary>("/api/admin/summary", controller.signal),
      apiGet<AdminQueriesResponse>("/api/admin/queries", controller.signal),
    ])
      .then(([s, q]) => {
        setSummary(s);
        setQueries(q.queries);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);

  return { summary, queries, error };
}
