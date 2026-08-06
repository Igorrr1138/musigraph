import { useEffect, useState } from 'react';
import { resolveGenreEntries, type GenreEntry, type ResolvedEntry } from '@/lib/genreDiscovery';

/**
 * Progressively resolves MBIDs + cover art for a list of genre entries.
 * Returns a key → ResolvedEntry map that fills in over time; the grid renders
 * immediately and each card swaps its skeleton for artwork as it lands.
 */
export function useGenreCovers(entries: ReadonlyArray<GenreEntry>) {
  const [resolved, setResolved] = useState<Record<string, ResolvedEntry>>({});

  useEffect(() => {
    if (entries.length === 0) return;
    let cancelled = false;
    void resolveGenreEntries(
      entries,
      (key, value) => {
        if (cancelled) return;
        setResolved(prev => (prev[key] ? prev : { ...prev, [key]: value }));
      },
      () => cancelled,
    );
    return () => {
      cancelled = true;
    };
  }, [entries]);

  return resolved;
}
