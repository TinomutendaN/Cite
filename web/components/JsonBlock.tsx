"use client";

import { Check, Copy, Download } from "lucide-react";
import { useCopy } from "@/hooks/useCopy";
import styles from "./JsonBlock.module.css";

type Kind = "key" | "string" | "literal" | "punct" | "space";
type Token = { kind: Kind; text: string };

const isPrimitive = (v: unknown) => v === null || typeof v !== "object";

/**
 * JSON as tokens, indented by 2 spaces like JSON.stringify(value, null, 2), except that an
 * object of plain values inside an array goes on one line: { "name": "…", "page": 1 }.
 */
function tokenize(value: unknown): Token[] {
  const out: Token[] = [];
  const push = (kind: Kind, text: string) => out.push({ kind, text });

  const write = (v: unknown, indent: string, inline: boolean) => {
    if (isPrimitive(v)) {
      push(typeof v === "string" ? "string" : "literal", JSON.stringify(v));
      return;
    }
    const isArray = Array.isArray(v);
    const entries: [string | null, unknown][] = isArray
      ? (v as unknown[]).map((item) => [null, item])
      : Object.entries(v as Record<string, unknown>);
    const [open, close] = isArray ? ["[", "]"] : ["{", "}"];
    if (entries.length === 0) {
      push("punct", open + close);
      return;
    }
    if (inline) {
      push("punct", `${open} `);
      entries.forEach(([key, item], i) => {
        if (key !== null) {
          push("key", JSON.stringify(key));
          push("punct", ": ");
        }
        write(item, indent, true);
        if (i < entries.length - 1) push("punct", ", ");
      });
      push("punct", ` ${close}`);
      return;
    }
    const inner = `${indent}  `;
    push("punct", open);
    entries.forEach(([key, item], i) => {
      push("space", `\n${inner}`);
      if (key !== null) {
        push("key", JSON.stringify(key));
        push("punct", ": ");
      }
      const flat =
        isArray && item !== null && typeof item === "object" && !Array.isArray(item) && Object.values(item).every(isPrimitive);
      write(item, inner, flat);
      if (i < entries.length - 1) push("punct", ",");
    });
    push("space", `\n${indent}`);
    push("punct", close);
  };

  write(value, "", false);
  return out;
}

/** The text shown in the JSON view; Copy JSON and the download use exactly this. */
export function formatJson(value: unknown): string {
  return tokenize(value)
    .map((t) => t.text)
    .join("");
}

/** Save `value` as a .json file. */
export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([`${formatJson(value)}\n`], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Dark code box with the JSON, syntax-coloured, plus download and copy buttons. */
export default function JsonBlock({ value, filename }: { value: unknown; filename: string }) {
  const { copied, copy } = useCopy();
  const tokens = tokenize(value);

  return (
    <div className={styles.box}>
      <div className={styles.panel}>
        <div className={styles.bar}>
          <span className={styles.label}>JSON</span>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.icon}
              onClick={() => downloadJson(value, filename)}
              aria-label={`Download ${filename}`}
              title={`Download ${filename}`}
            >
              <Download size={15} aria-hidden />
            </button>
            <button
              type="button"
              className={styles.icon}
              onClick={() => copy(formatJson(value))}
              aria-label={copied ? "Copied" : "Copy JSON"}
              title={copied ? "Copied" : "Copy JSON"}
            >
              {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
            </button>
          </div>
        </div>
        <pre className={styles.code}>
          <code>
            {tokens.map((t, i) =>
              t.kind === "space" ? (
                t.text
              ) : (
                <span key={i} className={styles[t.kind]}>
                  {t.text}
                </span>
              ),
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}
