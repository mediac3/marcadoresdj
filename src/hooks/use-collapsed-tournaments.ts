'use client';

import { useState, useCallback, useEffect } from 'react';

/* ════════════════════════════════════════════════════════════════════════════
   useOpenTournaments

   Persists the set of tournament IDs the visitor has EXPANDED in the public
   view. Tournaments are collapsed by default (empty set on first visit); once
   a visitor expands a tournament it stays open across reloads.

   Mirrors the SSR-safe hydrate-on-mount + persist-in-setter pattern of
   use-favorites.ts.
   ════════════════════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'marcadoresdj-open-tournaments';

function loadOpenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((v) => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function saveOpenIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Storage full — silently ignore
  }
}

export function useOpenTournaments() {
  // Collapsed by default: empty set means everything closed.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  // Hydrate from localStorage on mount (avoids SSR mismatch).
  useEffect(() => {
    setOpenIds(loadOpenIds());
  }, []);

  const isOpen = useCallback((id: string) => openIds.has(id), [openIds]);

  const toggle = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveOpenIds(next);
      return next;
    });
  }, []);

  const open = useCallback((id: string) => {
    setOpenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveOpenIds(next);
      return next;
    });
  }, []);

  return { isOpen, toggle, open };
}
