'use client';

import { useState, useCallback, useEffect } from 'react';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface FavoriteTeam {
  id: string;
  name: string;
  logo: string | null;
  shortName: string | null;
}

const STORAGE_KEY = 'marcadoresdj-favorites';

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function loadFavorites(): FavoriteTeam[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favs: FavoriteTeam[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  } catch {
    // Storage full — silently ignore
  }
}

/* ── Hook ──────────────────────────────────────────────────────────────────── */

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteTeam[]>([]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  const isFavorite = useCallback(
    (teamId: string) => favorites.some((f) => f.id === teamId),
    [favorites],
  );

  const toggleFavorite = useCallback(
    (team: { id: string; name: string; logo: string | null; shortName: string | null }) => {
      setFavorites((prev) => {
        const exists = prev.some((f) => f.id === team.id);
        const next = exists
          ? prev.filter((f) => f.id !== team.id)
          : [...prev, { id: team.id, name: team.name, logo: team.logo, shortName: team.shortName }];
        saveFavorites(next);
        return next;
      });
    },
    [],
  );

  const removeFavorite = useCallback((teamId: string) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== teamId);
      saveFavorites(next);
      return next;
    });
  }, []);

  return { favorites, isFavorite, toggleFavorite, removeFavorite };
}