"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { Provider, Source } from "@/types/api";

// The chat lives here, around the sidebar layout, so it survives moving between
// pages. A full page refresh clears it. Usage counts and the model choice live
// on the server; what's kept here is only the latest copy the server sent.

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

interface ChatContextValue {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  openSource: OpenSource | null;
  setOpenSource: (source: OpenSource | null) => void;
  usage: Usage | null;
  setUsage: React.Dispatch<React.SetStateAction<Usage | null>>;
  model: ModelInfo | null;
  setModel: React.Dispatch<React.SetStateAction<ModelInfo | null>>;
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
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const pendingRequestRef = useRef<AbortController | null>(null);
  const usageRequestedRef = useRef(false);

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
      model,
      setModel,
      limitReached,
      setLimitReached,
      pendingRequestRef,
      usageRequestedRef,
      reset,
    }),
    [messages, isLoading, openSource, usage, model, limitReached, reset],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}
