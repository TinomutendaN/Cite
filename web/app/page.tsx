import Link from "next/link";
import { ArrowRight, ArrowUpRight, MessageSquare } from "lucide-react";
import DemoVideo from "@/components/DemoVideo";
import { HEADLINE, LINKS, SUBLINE } from "@/constants/landing";
import styles from "./page.module.css";

function GithubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export default function Landing() {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logo}>
            <MessageSquare size={14} strokeWidth={2.2} />
          </span>
          Cite
        </Link>
        <nav className={styles.links}>
          <a href={LINKS.github} target="_blank" rel="noopener noreferrer" className={styles.link} aria-label="GitHub">
            <GithubMark />
            <span className={styles.linkText}>GitHub</span>
          </a>
          <a href={LINKS.portfolio} target="_blank" rel="noopener noreferrer" className={styles.link} aria-label="Portfolio">
            <ArrowUpRight size={16} strokeWidth={2} />
            <span className={styles.linkText}>Portfolio</span>
          </a>
        </nav>
      </header>

      <main className={styles.hero}>
        <section className={styles.copy}>
          <span className={styles.pill}>Company knowledge assistant</span>
          <h1 className={styles.headline}>{HEADLINE}</h1>
          <p className={styles.subline}>{SUBLINE}</p>
          <div className={styles.cta}>
            <Link href="/ask" className={styles.try}>
              Try it now
              <ArrowRight size={18} strokeWidth={2.2} />
            </Link>
            <span className={styles.note}>No sign-up. Nothing to upload.</span>
          </div>
        </section>

        <section className={styles.media}>
          <DemoVideo />
          <p className={styles.caption}>
            A quick walkthrough: asking a question, opening a source, extracting a contract.
          </p>
        </section>
      </main>
    </div>
  );
}
