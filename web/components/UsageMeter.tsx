import type { Usage } from "@/components/ChatProvider";
import styles from "./UsageMeter.module.css";

const RING_R = 6.5;
const RING_C = 2 * Math.PI * RING_R;

/** Questions used today out of the daily free limit (both from the server). */
export default function UsageMeter({ usage }: { usage: Usage | null }) {
  const limit = usage?.dailyLimit ?? 0;
  const used = usage ? Math.max(0, limit - usage.questionsLeft) : 0;
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const percent = Math.round(ratio * 100);

  return (
    <div className={`glass ${styles.meter}`}>
      <div className={styles.row}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className={styles.ring}>
          <circle cx="8" cy="8" r={RING_R} className={styles.ringTrack} />
          <circle
            cx="8"
            cy="8"
            r={RING_R}
            className={styles.ringFill}
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - ratio)}
          />
        </svg>
        <span className={styles.count}>{usage ? `${used} / ${limit} questions` : "Questions today"}</span>
        <span className={styles.percent}>{usage ? `${percent}%` : ""}</span>
      </div>
      <div
        className={styles.bar}
        role="progressbar"
        aria-label="Free questions used today"
        aria-valuemin={0}
        aria-valuemax={limit || undefined}
        aria-valuenow={usage ? used : undefined}
      >
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
