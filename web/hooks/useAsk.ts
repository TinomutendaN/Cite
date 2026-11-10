"use client";

import { useCallback } from "react";
import { useChat, type ChatMessage } from "@/components/ChatProvider";
import { ApiRequestError, apiStream } from "@/lib/api";
import type { AskRequest, AskStreamEvent, LimitError } from "@/types/api";

const ERROR_TEXT = "Something went wrong while answering.";

let nextId = 0;
const newId = () => `m${Date.now().toString(36)}-${nextId++}`;

/** Sends questions to POST /api/ask and shows each reply as it streams in. */
export function useAsk() {
  const {
    isLoading,
    setIsLoading,
    setMessages,
    setUsage,
    chosenProvider,
    limitReached,
    setLimitReached,
    usage,
    pendingRequestRef,
  } = useChat();

  const outOfQuestions = limitReached || usage?.questionsLeft === 0;

  const ask = useCallback(
    async (question: string) => {
      const controller = new AbortController();
      pendingRequestRef.current = controller;
      setIsLoading(true);

      // One reply bubble: added at the first streamed words, then updated in place.
      const replyId = newId();
      let shown = false;
      const show = (msg: ChatMessage) => {
        if (pendingRequestRef.current !== controller) return;
        const isNew = !shown;
        shown = true;
        setMessages((m) => (isNew ? [...m, msg] : m.map((x) => (x.id === replyId ? msg : x))));
      };

      let reply: ChatMessage;
      try {
        // The visitor's own model choice; the backend falls back to its default if it can't be used.
        const body: AskRequest = { question, provider: chosenProvider ?? undefined };
        let text = "";
        let final: AskStreamEvent | null = null;
        await apiStream<AskStreamEvent>(
          "/api/ask",
          body,
          (event) => {
            if (event.type === "delta") {
              text += event.text;
              show({ id: replyId, kind: "answer", text, sources: [], streaming: true });
            } else {
              final = event;
            }
          },
          controller.signal,
        );
        const res = final as AskStreamEvent | null;
        if (res?.type !== "done") throw new Error(res?.type === "error" ? res.message : "Stream ended early");
        // The final text replaces the streamed one (same words, tidied).
        reply = res.found
          ? { id: replyId, kind: "answer", text: res.answer, sources: res.sources }
          : { id: replyId, kind: "not_found" };
        // The daily limit only comes from GET /api/usage; until it has loaded there is nothing to update.
        setUsage((u) => (u ? { ...u, questionsLeft: res.questions_left } : u));
      } catch (err) {
        // "New chat" cancelled this question: drop the reply.
        if (controller.signal.aborted) return;
        if (err instanceof ApiRequestError && err.status === 429) {
          const body = err.body as LimitError | null;
          reply = {
            id: replyId,
            kind: "limit",
            text: body?.message ?? "You've used today's free questions. Come back tomorrow to ask more.",
          };
          setLimitReached(true);
          setUsage((u) => (u ? { ...u, questionsLeft: 0 } : u));
        } else {
          reply = { id: replyId, kind: "error", text: ERROR_TEXT, question };
        }
      }

      if (pendingRequestRef.current !== controller) return;
      show(reply);
      pendingRequestRef.current = null;
      setIsLoading(false);
    },
    [pendingRequestRef, setIsLoading, setMessages, setUsage, chosenProvider, setLimitReached],
  );

  /** Ask a new question. Ignored while another is in flight or once the limit is reached. */
  const send = useCallback(
    (text: string) => {
      const question = text.trim();
      if (!question || isLoading || outOfQuestions) return;
      setMessages((m) => [...m, { id: newId(), kind: "user", text: question }]);
      void ask(question);
    },
    [ask, isLoading, outOfQuestions, setMessages],
  );

  /** Resend the question behind an error reply, replacing that reply. */
  const retry = useCallback(
    (errorId: string, question: string) => {
      if (isLoading || outOfQuestions) return;
      setMessages((m) => m.filter((msg) => msg.id !== errorId));
      void ask(question);
    },
    [ask, isLoading, outOfQuestions, setMessages],
  );

  return { send, retry, isLoading, outOfQuestions };
}
