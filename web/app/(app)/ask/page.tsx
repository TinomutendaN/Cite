"use client";

import { useEffect, useRef } from "react";
import ChatInput from "@/components/ChatInput";
import ChatMessage, { ThinkingBubble } from "@/components/ChatMessage";
import { useChat } from "@/components/ChatProvider";
import DocumentTree from "@/components/DocumentTree";
import SourcePanel from "@/components/SourcePanel";
import UsageMeter from "@/components/UsageMeter";
import { categoryLabel } from "@/constants/documents";
import { STARTER_QUESTIONS } from "@/data/starterQuestions";
import { useAsk } from "@/hooks/useAsk";
import { useDocuments } from "@/hooks/useDocuments";
import { useUsage } from "@/hooks/useUsage";
import styles from "./page.module.css";

export default function AskPage() {
  const { messages, openSource, setOpenSource } = useChat();
  const { send, retry, isLoading, outOfQuestions } = useAsk();
  const { usage, model } = useUsage();
  const documents = useDocuments();
  const listRef = useRef<HTMLDivElement>(null);

  const firstQuestion = messages.find((m) => m.kind === "user");
  const title = firstQuestion?.kind === "user" ? firstQuestion.text : "New chat";

  const openAnswer = openSource ? messages.find((m) => m.id === openSource.messageId) : undefined;
  const openSources = openAnswer?.kind === "answer" ? openAnswer.sources : [];
  const shownSource = openSources.find((s) => s.n === openSource?.n);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages.length, isLoading]);

  const placeholder = outOfQuestions
    ? "You've used today's free questions."
    : messages.length > 0
      ? "Ask a follow-up question…"
      : "Ask about leave, travel, the patient portal or a contract…";

  return (
    <div className={`${styles.page} ${shownSource ? styles.withSource : ""}`}>
      <section className={styles.centre} aria-label="Chat">
        <header className={`glass ${styles.header}`}>
          <h1 className={styles.title}>{title}</h1>
        </header>

        <div className={styles.messages} ref={listRef} aria-live="polite">
          {messages.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.welcome}>
                <p className={styles.welcomeTitle}>Hi! Ask me anything about the company documents.</p>
                <p className={styles.welcomeText}>
                  I answer from the company policies, the patient portal guide and the vendor contracts,
                  and I show the exact source for every answer. Try one of these:
                </p>
              </div>
              <ul className={styles.starters}>
                {STARTER_QUESTIONS.map((s) => (
                  <li key={s.question}>
                    <button
                      type="button"
                      className={`glass ${styles.starter}`}
                      onClick={() => send(s.question)}
                      disabled={isLoading || outOfQuestions}
                    >
                      <span className="label">{categoryLabel(s.category)}</span>
                      <span className={styles.starterQuestion}>{s.question}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  activeSource={openSource?.messageId === m.id ? openSource.n : null}
                  onOpenSource={(n) => setOpenSource({ messageId: m.id, n })}
                  onRetry={m.kind === "error" ? () => retry(m.id, m.question) : undefined}
                  retryDisabled={isLoading || outOfQuestions}
                />
              ))}
              {isLoading && <ThinkingBubble />}
            </>
          )}
        </div>

        <ChatInput
          onSend={send}
          disabled={outOfQuestions}
          busy={isLoading}
          placeholder={placeholder}
          model={model}
        />
      </section>

      <aside className={styles.side} aria-label={shownSource ? "Source" : "Sample documents"}>
        {shownSource && openSource ? (
          <SourcePanel
            source={shownSource}
            sources={openSources}
            onSelect={(n) => setOpenSource({ messageId: openSource.messageId, n })}
            onClose={() => setOpenSource(null)}
          />
        ) : (
          <>
            <div className={`glass ${styles.sideTitle}`}>
              <h2>Sample documents</h2>
            </div>
            <div className={`glass ${styles.treeCard}`}>
              {documents.data ? (
                <DocumentTree documents={documents.data} />
              ) : (
                <p className={styles.status}>
                  {documents.error ? "Couldn't load the documents." : "Loading documents…"}
                </p>
              )}
            </div>
          </>
        )}
        <UsageMeter usage={usage} />
      </aside>
    </div>
  );
}
