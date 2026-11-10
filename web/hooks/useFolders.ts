"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { CATEGORIES } from "@/constants/documents";
import type { Category } from "@/types/api";

const ALL = CATEGORIES.map((c) => c.id);

interface FolderOptions {
  /** Open this folder whenever it changes (e.g. the folder of the document being read). */
  reveal?: Category | null;
  /**
   * Once `ready`, if the tree overflows the scroll box `ref`, open only `fallback` (keep it a
   * constant, not a new array each render).
   * Runs once, so the visitor's own choices are never undone.
   */
  fit?: { ref: RefObject<HTMLElement | null>; ready: boolean; fallback: Category[] };
}

/** Which folders of the DocumentTree are open. */
export function useFolders(initial: Category[] | "all", { reveal, fit }: FolderOptions = {}) {
  const [open, setOpen] = useState<Set<Category>>(() => new Set(initial === "all" ? ALL : initial));

  // Open the revealed folder during render (not in an effect), so it never shows closed first.
  const [revealed, setRevealed] = useState<Category | null>(null);
  if (reveal && reveal !== revealed) {
    setRevealed(reveal);
    if (!open.has(reveal)) setOpen(new Set(open).add(reveal));
  }

  const fitted = useRef(false);
  const fitRef = fit?.ref;
  const fitReady = fit?.ready ?? false;
  const fallback = fit?.fallback;
  useLayoutEffect(() => {
    const box = fitRef?.current;
    if (fitted.current || !fitReady || !box || !fallback) return;
    // The observer reports once right after layout (before paint), so nothing flashes.
    const observer = new ResizeObserver(() => {
      observer.disconnect();
      fitted.current = true;
      if (box.scrollHeight > box.clientHeight + 1) setOpen(new Set(fallback));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [fitRef, fitReady, fallback]);

  const toggle = useCallback((category: Category) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(category)) next.add(category);
      return next;
    });
  }, []);
  const openAll = useCallback(() => setOpen(new Set(ALL)), []);
  const closeAll = useCallback(() => setOpen(new Set()), []);

  return { open, toggle, openAll, closeAll };
}
