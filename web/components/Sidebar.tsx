"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import { NAV_ITEMS } from "@/constants/nav";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={`glass ${styles.card}`}>
        <Link href="/" className={styles.brand}>
          Cite
        </Link>
        {/* TODO: reset the chat through ChatProvider once it exists. */}
        <Link href="/ask" className={`btn-primary ${styles.fullWidth}`}>
          <Plus size={18} aria-hidden />
          New chat
        </Link>
      </div>

      <nav className={`glass ${styles.card}`} aria-label="Main">
        <span className={`label ${styles.menuLabel}`}>Menu</span>
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
                  <Icon size={18} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Link href="/" className={`glass ${styles.card} ${styles.backHome}`}>
        <ArrowLeft size={18} aria-hidden />
        Back to home
      </Link>

      <div className={`${styles.card} ${styles.freeDemo}`}>
        <span className={styles.freeDemoTitle}>
          <Sparkles size={16} aria-hidden />
          Free demo
        </span>
        <p>No sign-up. A few free questions every day.</p>
      </div>
    </aside>
  );
}
