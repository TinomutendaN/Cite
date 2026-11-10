"use client";

import { useEffect } from "react";
import { useChat } from "@/components/ChatProvider";
import { apiGet } from "@/lib/api";
import type { UsageResponse } from "@/types/api";

/**
 * Today's question count and the answer models (site default, each provider's
 * model name, whether the local model is available). `model` is the one that
 * answers this visitor's next question: their own choice if usable, else the default.
 * Loaded from GET /api/usage once per page load (several components may ask at
 * once; only one request is made), then kept up to date by each answer.
 */
export function useUsage() {
  const { usage, setUsage, model, serverModels, setServerModels, usageRequestedRef } = useChat();

  useEffect(() => {
    if (usageRequestedRef.current) return;
    usageRequestedRef.current = true;
    apiGet<UsageResponse>("/api/usage")
      .then((res) => {
        setUsage({ questionsLeft: res.questions_left, dailyLimit: res.daily_limit });
        setServerModels({
          defaultProvider: res.provider,
          models: res.models,
          ollamaAvailable: res.ollama_available,
        });
      })
      .catch(() => {
        // Let a later mount try again; the meter just stays empty meanwhile.
        usageRequestedRef.current = false;
      });
  }, [setUsage, setServerModels, usageRequestedRef]);

  return { usage, model, serverModels };
}
