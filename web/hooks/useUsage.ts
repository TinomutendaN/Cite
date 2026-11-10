"use client";

import { useEffect } from "react";
import { useChat } from "@/components/ChatProvider";
import { apiGet } from "@/lib/api";
import type { UsageResponse } from "@/types/api";

/**
 * Today's question count and the current answer model.
 * Loaded from GET /api/usage once per page load (several components may ask at
 * once; only one request is made), then kept up to date by each answer.
 */
export function useUsage() {
  const { usage, setUsage, model, setModel, usageRequestedRef } = useChat();

  useEffect(() => {
    if (usageRequestedRef.current) return;
    usageRequestedRef.current = true;
    apiGet<UsageResponse>("/api/usage")
      .then((res) => {
        setUsage({ questionsLeft: res.questions_left, dailyLimit: res.daily_limit });
        // An answer that arrived first has the newer model; keep it.
        setModel((current) => current ?? { provider: res.provider, model: res.model });
      })
      .catch(() => {
        // Let a later mount try again; the meter just stays empty meanwhile.
        usageRequestedRef.current = false;
      });
  }, [setUsage, setModel, usageRequestedRef]);

  return { usage, model };
}
