"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Clock, Copy, RotateCcw, TriangleAlert, User, ZoomOut } from "lucide-react";
import SourceTag from "@/components/SourceTag";
import type { ChatMessage as Message } from "@/components/ChatProvider";
import { documentHref } from "@/constants/documents";
import type { Source } from "@/types/api";
import styles from "./ChatMessage.module.css";

interface ChatMessageProps {
  message: Message;
  /** The open source tag of this answer, if any. */
  activeSource?: number | null;
  onOpenSource?: (n: number) => void;
  onRetry?: () => void;
  retryDisabled?: boolean;
}

export default function ChatMessage({
  message,
  activeSource = null,
  onOpenSource,
  onRetry,
  retryDisabled,
}: ChatMessageProps) {
  switch (message.kind) {
    case "user":
      return (
        <div className={styles.userRow}>
          <p className={`glass ${styles.userBubble}`}>{message.text}</p>
          <span className={styles.avatar} aria-hidden>
            <User size={16} strokeWidth={1.75} />
          </span>
        </div>
      );

    case "answer":
      // While streaming, the source tags show but can't open yet: the sources arrive at the end.
      return (
        <div className={`${styles.bubble} ${styles.answer}`} aria-busy={message.streaming || undefined}>
          <AnswerText
            text={message.text}
            activeSource={activeSource}
            onOpenSource={message.streaming ? undefined : onOpenSource}
          />
          {message.sources[0] && <QuoteBlock source={message.sources[0]} />}
        </div>
      );

    case "not_found":
      return (
        <Notice icon={<ZoomOut size={18} aria-hidden />} title="I couldn't find this in the documents.">
          None of the company documents cover this, so I won&apos;t guess. Try rephrasing, or{" "}
          <Link href="/documents" className={styles.link}>
            browse the documents
          </Link>
          .
        </Notice>
      );

    case "limit":
      return (
        <Notice icon={<Clock size={18} aria-hidden />} title="That's all for today.">
          {message.text}
        </Notice>
      );

    case "error":
      return (
        <Notice icon={<TriangleAlert size={18} aria-hidden />} title={message.text}>
          <p>Please try again in a moment.</p>
          {onRetry && (
            <button type="button" className={styles.retry} onClick={onRetry} disabled={retryDisabled}>
              <RotateCcw size={14} aria-hidden />
              Try again
            </button>
          )}
        </Notice>
      );
  }
}

/** The dark "searching" bubble shown while waiting for an answer. */
export function ThinkingBubble() {
  return (
    <div className={`${styles.bubble} ${styles.thinking}`} role="status">
      <span className={styles.dots} aria-hidden>
        <span />
        <span />
        <span />
      </span>
      Searching the documents…
    </div>
  );
}

function Notice({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className={`${styles.bubble} ${styles.notice}`}>
      <span className={styles.noticeIcon}>{icon}</span>
      <div>
        <p className={styles.noticeTitle}>{title}</p>
        <div className={styles.noticeBody}>{children}</div>
      </div>
    </div>
  );
}

function QuoteBlock({ source }: { source: Source }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    navigator.clipboard
      ?.writeText(source.content)
      .then(() => setCopied(true))
      .catch(() => {});
  };

  return (
    <figure className={styles.quote}>
      <figcaption className={styles.quoteHeader}>
        <span>
          Source {source.n} · {source.title}, p. {source.page}
        </span>
        <span className={styles.quoteActions}>
          <Link
            href={documentHref(source.document_id, source.page, source.chunk_id)}
            className={styles.iconButton}
            aria-label={`Open ${source.title} at page ${source.page}`}
          >
            <ArrowUpRight size={16} aria-hidden />
          </Link>
          <button
            type="button"
            className={styles.iconButton}
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy passage"}
          >
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          </button>
        </span>
      </figcaption>
      <blockquote className={styles.quoteText}>“{source.content}”</blockquote>
    </figure>
  );
}

// --- Answer text ------------------------------------------------------------------
// The model writes short paragraphs or "- " bullet lists with citations like [1].
// A tiny renderer (no markdown library): paragraphs, bullet and numbered lists,
// **bold**, and [n] as source tags.

type Block = { type: "p"; lines: string[] } | { type: "ul" | "ol"; items: string[] };

const BULLET_RE = /^\s*[-*•]\s+/;
const NUMBERED_RE = /^\s*\d+[.)]\s+/;

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const last = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ type: "p", lines: [] });
      continue;
    }
    const listType = BULLET_RE.test(line) ? "ul" : NUMBERED_RE.test(line) ? "ol" : null;
    if (listType) {
      const item = line.replace(listType === "ul" ? BULLET_RE : NUMBERED_RE, "");
      if (last?.type === listType) last.items.push(item);
      else blocks.push({ type: listType, items: [item] });
    } else if (last?.type === "p") {
      last.lines.push(line.trim());
    } else {
      blocks.push({ type: "p", lines: [line.trim()] });
    }
  }
  return blocks.filter((b) => (b.type === "p" ? b.lines.length > 0 : true));
}

function AnswerText({
  text,
  activeSource,
  onOpenSource,
}: {
  text: string;
  activeSource: number | null;
  onOpenSource?: (n: number) => void;
}) {
  // A run of citations like [1][2] stays together on one line.
  const inline = (s: string) =>
    s.split(/((?:\[\d+\])+|\*\*[^*]+\*\*)/g).map((part, i) => {
      if (/^(\[\d+\])+$/.test(part)) {
        return (
          <span key={i} className={styles.cites}>
            {[...part.matchAll(/\[(\d+)\]/g)].map(([, num]) => {
              const n = Number(num);
              return (
                <SourceTag
                  key={n}
                  n={n}
                  active={activeSource === n}
                  onClick={onOpenSource ? () => onOpenSource(n) : undefined}
                />
              );
            })}
          </span>
        );
      }
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
      return <Fragment key={i}>{part}</Fragment>;
    });

  return (
    <div className={styles.answerText}>
      {parseBlocks(text).map((block, i) => {
        if (block.type === "p") return <p key={i}>{inline(block.lines.join(" "))}</p>;
        const List = block.type;
        return (
          <List key={i}>
            {block.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
