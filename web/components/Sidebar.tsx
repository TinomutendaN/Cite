"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftToLine, ArrowUpRight, MessageSquare, Plus } from "lucide-react";
import { NAV_ITEMS } from "@/constants/nav";
import { useChat } from "@/components/ChatProvider";
import { useUsage } from "@/hooks/useUsage";
import styles from "./Sidebar.module.css";

const REPO_URL = "https://github.com/TinomutendaN/Cite";

export default function Sidebar() {
  const pathname = usePathname();
  const { reset } = useChat();
  const { usage } = useUsage();

  return (
    <aside className={styles.sidebar}>
      <div className={`glass ${styles.card} ${styles.top}`}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logo} aria-hidden>
            <MessageSquare size={14} strokeWidth={2.2} />
          </span>
          Cite
        </Link>
        <Link href="/ask" onClick={reset} className={`btn-primary ${styles.newChat}`}>
          <Plus size={16} aria-hidden />
          New chat
        </Link>
      </div>

      <div className={styles.middle}>
        <nav className={`glass ${styles.card} ${styles.menuCard}`} aria-label="Main">
          <ul className={styles.menu}>
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`${styles.menuItem} ${active ? styles.active : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <Link href="/" className={`glass ${styles.card} ${styles.backHome}`}>
          <ArrowLeftToLine size={16} strokeWidth={1.75} aria-hidden />
          Back to home
        </Link>
      </div>

      <div className={styles.freeDemo}>
        <h2 className={styles.freeDemoTitle}>Free demo</h2>
        <p className={styles.freeDemoText}>
          {usage ? `Ask up to ${usage.dailyLimit} questions a day.` : "Ask a few questions a day."} No
          sign-up needed.
        </p>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className={styles.builtButton}>
          See how it&apos;s built
          <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden />
        </a>
      </div>
    </aside>
  );
}
