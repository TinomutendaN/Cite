import styles from "./SourceTag.module.css";

interface SourceTagProps {
  n: number;
  /** Orange: this source is open in the panel. */
  active?: boolean;
  /** "dark" sits on dark bubbles; "solid" is the darker chip used on light cards. */
  tone?: "dark" | "solid";
  /** Makes the tag a button. Without it the tag is just a label. */
  onClick?: () => void;
  label?: string;
}

export default function SourceTag({ n, active = false, tone = "dark", onClick, label }: SourceTagProps) {
  const className = `${styles.tag} ${styles[tone]} ${active ? styles.active : ""}`;
  if (!onClick) {
    return (
      <span className={className} aria-hidden={label ? undefined : true} aria-label={label}>
        {n}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`${className} ${styles.button}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={label ?? `Show source ${n}`}
    >
      {n}
    </button>
  );
}
