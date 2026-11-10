"use client";

import { useCallback } from "react";
import { useChat } from "@/components/ChatProvider";
import { useUsage } from "@/hooks/useUsage";
import type { Provider } from "@/types/api";

/**
 * This visitor's answer-model choice (Admin page). Kept in the browser and sent
 * with each question, so one visitor's switch never changes the model for others.
 */
export function useModelChoice() {
  const { setChosenProvider } = useChat();
  const { model, serverModels } = useUsage();
  const ollamaAvailable = serverModels?.ollamaAvailable ?? false;

  const choose = useCallback(
    (provider: Provider) => {
      if (provider === "ollama" && !ollamaAvailable) return;
      setChosenProvider(provider);
    },
    [ollamaAvailable, setChosenProvider],
  );

  return { selected: model?.provider ?? null, choose, ollamaAvailable, ready: serverModels !== null };
}
