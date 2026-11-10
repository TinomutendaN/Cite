"use client";

import { useState } from "react";
import { FileText, Send } from "lucide-react";
import type { ModelInfo } from "@/components/ChatProvider";
import { PROVIDERS } from "@/constants/models";
import styles from "./ChatInput.module.css";

interface ChatInputProps {
  onSend: (text: string) => void;
  /** No typing at all (e.g. the daily limit is reached). */
  disabled: boolean;
  /** Typing allowed, but sending waits (an answer is on its way). */
  busy: boolean;
  placeholder: string;
  model: ModelInfo | null;
}

export default function ChatInput({ onSend, disabled, busy, placeholder, model }: ChatInputProps) {
  const [text, setText] = useState("");
  const canSend = !disabled && !busy && text.trim().length > 0;
  const provider = model ? PROVIDERS[model.provider] : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    onSend(text);
    setText("");
  };

  return (
    <form className={`glass ${styles.box}`} onSubmit={submit}>
      <div className={styles.chips}>
        <span className={styles.chip}>
          <FileText size={14} aria-hidden className={styles.docsIcon} />
          Company docs
        </span>
        {model && provider && (
          <span className={styles.chip} title={`Answers by ${provider.label}, ${model.model}`}>
            <provider.icon size={14} aria-hidden className={styles.modelIcon} />
            {provider.label}
            <span className={styles.modelName}>· {model.model}</span>
          </span>
        )}
      </div>
      <div className={styles.row}>
        <input
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={500}
          aria-label="Your question"
        />
        <button type="submit" className={styles.send} disabled={disabled || busy} aria-label="Send question">
          <Send size={18} aria-hidden />
        </button>
      </div>
    </form>
  );
}
