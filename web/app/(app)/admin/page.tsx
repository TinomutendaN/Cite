"use client";

import { Check, Clock, DollarSign, MessageSquare, type LucideIcon } from "lucide-react";
import { PROVIDER_ORDER, PROVIDERS } from "@/constants/models";
import { useAdmin } from "@/hooks/useAdmin";
import { useModelChoice } from "@/hooks/useModelChoice";
import type { AdminQuery } from "@/types/api";
import styles from "./page.module.css";

const TIME = { hour: "numeric", minute: "2-digit" } as const;

/** Local time; rows from an earlier day also get a short date. */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], TIME);
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

const formatSpeed = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)}s`);

function formatRowCost(q: AdminQuery): string {
  return q.provider === "ollama" ? "Free" : `$${q.cost_usd.toFixed(4)}`;
}

/** Two decimals, or four for a non-zero total under a cent (so it doesn't read as $0.00). */
function formatTotal(usd: number): string {
  return `$${usd > 0 && usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2)}`;
}

function StatCard({ label, value, caption, icon: Icon }: { label: string; value: string; caption?: string; icon: LucideIcon }) {
  return (
    <div className={`glass ${styles.stat}`}>
      <div className={styles.statTop}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statIcon} aria-hidden>
          <Icon size={16} strokeWidth={2} />
        </span>
      </div>
      <span className={styles.statValue}>{value}</span>
      {caption && <span className={styles.statCaption}>{caption}</span>}
    </div>
  );
}

export default function AdminPage() {
  const { summary, queries, error } = useAdmin();
  const { selected, choose, ollamaAvailable, ready } = useModelChoice();

  const dash = error ? "–" : "…";
  const capPercent = summary && summary.daily_cap > 0 ? Math.min(100, Math.round((summary.cap_used / summary.daily_cap) * 100)) : 0;

  return (
    <div className={styles.page}>
      <section className={styles.centre} aria-label="Usage">
        <header className={`glass ${styles.header}`}>
          <h1 className={styles.title}>Admin</h1>
          <span className={styles.today}>Today</span>
        </header>

        <div className={styles.stats}>
          <StatCard
            label="Questions today"
            value={summary ? String(summary.questions_today) : dash}
            caption="Across all visitors"
            icon={MessageSquare}
          />
          <StatCard
            label="Average response time"
            value={summary ? formatSpeed(summary.avg_first_token_ms) : dash}
            icon={Clock}
          />
          <StatCard
            label="Total cost today"
            value={summary ? formatTotal(summary.cost_today_usd) : dash}
            caption="All models combined"
            icon={DollarSign}
          />
        </div>

        <div className={`glass ${styles.recent}`}>
          <h2 className={styles.recentTitle}>Recent questions</h2>
          <div className={styles.tableWrap}>
            {queries && queries.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.colTime}>Time</th>
                    <th scope="col">Question</th>
                    <th scope="col" className={styles.colModel}>Model</th>
                    <th scope="col" className={styles.num}>Speed</th>
                    <th scope="col" className={styles.num}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map((q) => (
                    <tr key={q.id}>
                      <td className={styles.colTime}>
                        <time dateTime={q.created_at}>{formatTime(q.created_at)}</time>
                      </td>
                      <td className={styles.question}>{q.question}</td>
                      <td className={styles.colModel}>
                        <span
                          className={styles.modelChip}
                          style={{ background: PROVIDERS[q.provider].chipColor }}
                          title={q.model}
                        >
                          {PROVIDERS[q.provider].adminLabel}
                        </span>
                      </td>
                      <td
                        className={styles.num}
                        title={
                          q.first_token_ms === null
                            ? "Asked before answers were streamed"
                            : `Started to appear after ${formatSpeed(q.first_token_ms)}; full answer after ${formatSpeed(q.latency_ms)}`
                        }
                      >
                        {formatSpeed(q.first_token_ms)}
                      </td>
                      <td className={styles.num}>{formatRowCost(q)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={styles.status}>
                {error
                  ? "Couldn't load your questions."
                  : queries
                    ? "No questions yet. Ask one on the Ask page."
                    : "Loading…"}
              </p>
            )}
          </div>
        </div>
      </section>

      <aside className={styles.side} aria-label="Settings">
        <div className={`glass ${styles.sideTitle}`}>
          <h2>Settings</h2>
        </div>

        <div className={`glass ${styles.modelCard}`}>
          <h3 id="model-title" className={styles.cardTitle}>Model</h3>
          <div className={styles.options} role="radiogroup" aria-labelledby="model-title">
            {PROVIDER_ORDER.map((p) => {
              const info = PROVIDERS[p];
              const disabled = !ready || (p === "ollama" && !ollamaAvailable);
              const checked = selected === p;
              return (
                <label
                  key={p}
                  className={`${styles.option} ${checked ? styles.optionChecked : ""} ${disabled ? styles.optionDisabled : ""}`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={p}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => choose(p)}
                    className={styles.radio}
                  />
                  <span className={styles.optionText}>
                    <span className={styles.optionName}>{info.adminLabel}</span>
                    <span className={styles.optionDesc}>
                      {p === "ollama" && ready && !ollamaAvailable ? "Available when self-hosted" : info.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className={styles.note}>Applies to new questions.</p>
        </div>

        <div className={`glass ${styles.capCard}`}>
          <div className={styles.capTop}>
            <h3 className={styles.cardTitle}>Daily usage cap</h3>
            {summary &&
              (summary.cap_reached ? (
                <span className={`${styles.capChip} ${styles.capChipReached}`}>Limit reached</span>
              ) : (
                <span className={styles.capChip}>
                  <Check size={12} strokeWidth={2.5} aria-hidden />
                  Under limit
                </span>
              ))}
          </div>
          <div className={styles.capRow}>
            <span>{summary ? `${summary.cap_used} of ${summary.daily_cap} questions` : error ? "Couldn't load" : "Loading…"}</span>
            <span>{summary ? `${capPercent}%` : ""}</span>
          </div>
          <div
            className={styles.bar}
            role="progressbar"
            aria-label="Questions used today against the daily cap"
            aria-valuemin={0}
            aria-valuemax={summary?.daily_cap}
            aria-valuenow={summary?.cap_used}
          >
            <span className={styles.fill} style={{ width: `${capPercent}%` }} />
          </div>
          <p className={styles.note}>
            Resets at midnight UTC. Visitors see &ldquo;limit reached&rdquo; once the cap is hit.
          </p>
        </div>
      </aside>
    </div>
  );
}
