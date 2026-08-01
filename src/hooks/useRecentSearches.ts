import { useCallback, useEffect, useState } from 'react';

export const RECENT_SEARCHES_KEY = 'rankify_recent_searches';
const MAX_ITEMS = 8;

export interface RecentSearchItem {
  /** Stable identity: `query:<text>` | `artist:<mbid>` | `album:<mbid>` */
  id: string;
  type: 'query' | 'artist' | 'album';
  label: string;
  /** Secondary line (e.g. artist name for an album). */
  subtitle?: string;
  imageUrl?: string | null;
  /** Route to navigate to for entity items. */
  href?: string;
}

function read(): RecentSearchItem[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((i): i is RecentSearchItem => !!i && typeof i.id === 'string').slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function write(items: RecentSearchItem[]) {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable — history stays in-memory only */
  }
}

/** Notifies other mounted instances in the same tab. */
const EVENT = 'rankify:recent-searches';

export function useRecentSearches() {
  const [items, setItems] = useState<RecentSearchItem[]>(() => (typeof window === 'undefined' ? [] : read()));

  useEffect(() => {
    const sync = () => setItems(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const commit = useCallback((next: RecentSearchItem[]) => {
    write(next);
    setItems(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const add = useCallback(
    (item: RecentSearchItem) => {
      const next = [item, ...read().filter((i) => i.id !== item.id)].slice(0, MAX_ITEMS);
      commit(next);
    },
    [commit],
  );

  const remove = useCallback(
    (id: string) => commit(read().filter((i) => i.id !== id)),
    [commit],
  );

  const clear = useCallback(() => commit([]), [commit]);

  return { items, add, remove, clear };
}
