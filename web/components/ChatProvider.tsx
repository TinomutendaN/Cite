"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { Provider, Source } from "@/types/api";

// The chat lives here, around the sidebar layout, so it survives moving between
// pages. A full page refresh clears it. Usage counts live on the server; what's
// kept here is only the latest copy the server sent. The visitor's model choice
// (Admin page) is kept in localStorage and sent with each question.

export type ChatMessage =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "answer"; text: string; sources: Source[] }
  | { id: string; kind: "not_found" }
  | { id: string; kind: "limit"; text: string }
  | { id: string; kind: "error"; text: string; question: string };

/** Which source tag is open in the right panel: tag `n` of answer `messageId`. */
export interface OpenSource {
  messageId: string;
  n: number;
}

export interface Usage {
  questionsLeft: number;
  dailyLimit: number;
}

export interface ModelInfo {
  provider: Provider;
  model: string;
}

/** What GET /api/usage says about the answer models. */
export interface ServerModels {
  defaultProvider: Provider;
  models: Record<Provider, string>;
  ollamaAvailable: boolean;
}

const CHOICE_KEY = "cite.provider";
const PROVIDER_IDS: readonly string[] = ["openai", "anthropic", "ollama"];
const isProvider = (v: string | null): v is Provider => v !== null && PROVIDER_IDS.includes(v);

/** localStorage can be missing or throw (private windows, blocked site data). */
function readStoredChoice(): Provider | null {
  try {
    const stored = window.localStorage.getItem(CHOICE_KEY);
    return isProvider(stored) ? stored : null;
  } catch {
    return null;
  }
}

interface ChatContextValue {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  openSource: OpenSource | null;
  setOpenSource: (source: OpenSource | null) => void;
  usage: Usage | null;
  setUsage: React.Dispatch<React.SetStateAction<Usage | null>>;
  serverModels: ServerModels | null;
  setServerModels: (models: ServerModels) => void;
  /** The visitor's own model choice, or null to use the site default. */
  chosenProvider: Provider | null;
  setChosenProvider: (provider: Provider) => void;
  /** The model that answers this visitor's next question: their choice if usable, else the default. */
  model: ModelInfo | null;
  /** Set by a 429: no more questions today. */
  limitReached: boolean;
  setLimitReached: (reached: boolean) => void;
  /** The in-flight question, so "New chat" can cancel it. */
  pendingRequestRef: React.RefObject<AbortController | null>;
  /** True while GET /api/usage is in flight, so it is only requested once. */
  usageRequestedRef: React.RefObject<boolean>;
  /** "New chat": clears the conversation and cancels any question in flight. */
  reset: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openSource, setOpenSource] = useState<OpenSource | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [serverModels, setServerModelsState] = useState<ServerModels | null>(null);
  const [chosenProvider, setChosen] = useState<Provider | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const pendingRequestRef = useRef<AbortController | null>(null);
  const usageRequestedRef = useRef(false);

  // The stored choice is read when the server's model info arrives (from
  // GET /api/usage): until then there is no model to show or send anyway.
  const setServerModels = useCallback((models: ServerModels) => {
    setServerModelsState(models);
    setChosen((current) => current ?? readStoredChoice());
  }, []);

  const setChosenProvider = useCallback((provider: Provider) => {
    setChosen(provider);
    try {
      window.localStorage.setItem(CHOICE_KEY, provider);
    } catch {
      // Not remembered after a reload, but still used for this visit.
    }
  }, []);

  const model = useMemo<ModelInfo | null>(() => {
    if (!serverModels) return null;
    const usable = chosenProvider !== null && (chosenProvider !== "ollama" || serverModels.ollamaAvailable);
    const provider = usable ? chosenProvider : serverModels.defaultProvider;
    return { provider, model: serverModels.models[provider] };
  }, [serverModels, chosenProvider]);

  const reset = useCallback(() => {
    pendingRequestRef.current?.abort();
    pendingRequestRef.current = null;
    setMessages([]);
    setOpenSource(null);
    setIsLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      messages,
      setMessages,
      isLoading,
      setIsLoading,
      openSource,
      setOpenSource,
      usage,
      setUsage,
      serverModels,
      setServerModels,
      chosenProvider,
      setChosenProvider,
      model,
      limitReached,
      setLimitReached,
      pendingRequestRef,
      usageRequestedRef,
      reset,
    }),
    [
      messages,
      isLoading,
      openSource,
      usage,
      serverModels,
      setServerModels,
      chosenProvider,
      setChosenProvider,
      model,
      limitReached,
      reset,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}
